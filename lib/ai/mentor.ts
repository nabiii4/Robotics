import 'server-only';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { env } from '../env';
import { ApiError } from '../api';
import type { SessionUser } from '../auth/session';
import { aiMode } from './config';
import { callModel, AiError, type ChatMsg, type Mode } from './client';
import { MENTOR_SYSTEM, REPAIR_JSON, SUMMARIZE, CHIP_PROMPTS } from './prompts';
import { parseEnvelope, fallbackEnvelope, type EnvelopeT } from './envelope';
import { buildContext } from './context';
import { demoEnvelope } from './demo';
import { addMemory, findMemory, forgetMemory } from './memory';
import { createVersion, getVersion, tryDerive } from '../services/builds';
import { failingErrors, type RuleCheck } from '../robot/rules';
import { SpecValidationError } from '../robot/normalize';
import { logActivity, firstName, notifyRoles } from '../services/activity';
import { rateLimit } from '../auth/rateLimit';

export const SAFE_FILTERED = "I can't help with that one. Let's keep it about robotics!";
const CRISIS = /\b(kill myself|suicid|end my life|hurt myself|self[- ]harm|want to die|cutting myself|don'?t want to live)\b/i;
const CRISIS_REPLY = "I'm really glad you told me, and I'm sorry you're feeling this way. You deserve support right now. Please talk to a trusted adult — a parent, your coach, a teacher, or the school counselor — as soon as you can.\n\nIf you're in the US, you can **call or text 988** (the 988 Suicide & Crisis Lifeline) any time, day or night. If you're in immediate danger, call 911.\n\nYou're not alone, and people want to help.";

export interface MentorInput {
  user: SessionUser;
  message: string;
  threadId?: string | null;
  buildId?: string | null;
  mode?: 'chat' | 'create';
  chipId?: string;
  codeContext?: { fileId: string } | null;
  signal?: AbortSignal;
  retryMessageId?: string;
}

const today = () => new Date().toISOString().slice(0, 10);

async function checkLimits(user: SessionUser) {
  const lim = (await db.query.settingsKv.findFirst({ where: eq(schema.settingsKv.key, 'ai.limits') }))?.value as { perHour?: number; perDay?: number; teamDaily?: number } | undefined;
  const perHour = lim?.perHour ?? env().AI_MAX_REQUESTS_PER_HOUR;
  const perDay = lim?.perDay ?? env().AI_MAX_REQUESTS_PER_DAY;
  const team = lim?.teamDaily ?? env().AI_GLOBAL_DAILY_CAP;
  const h = await rateLimit(`ai:h:${user.id}`, perHour, 3_600_000);
  if (!h.ok) throw new ApiError(429, 'rate_limited', `You've reached this hour's mentor limit (${perHour}). It resets at ${new Date(h.resetAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`);
  const usage = await db.query.aiUsage.findFirst({ where: and(eq(schema.aiUsage.userId, user.id), eq(schema.aiUsage.day, today())) });
  if ((usage?.requests ?? 0) >= perDay) throw new ApiError(429, 'rate_limited', `You've reached today's mentor limit (${perDay}). It resets tomorrow.`);
  const all = await db.select({ n: sql<number>`coalesce(sum(${schema.aiUsage.requests}),0)` }).from(schema.aiUsage).where(eq(schema.aiUsage.day, today()));
  if (Number(all[0]?.n ?? 0) >= team) throw new ApiError(429, 'rate_limited', 'The team has used today’s mentor budget. It resets tomorrow.');
  return { remaining: h.remaining };
}

async function recordUsage(userId: string, tin: number, tout: number) {
  await db.insert(schema.aiUsage).values({ userId, day: today(), requests: 1, tokensIn: tin, tokensOut: tout })
    .onConflictDoUpdate({ target: [schema.aiUsage.userId, schema.aiUsage.day], set: { requests: sql`${schema.aiUsage.requests} + 1`, tokensIn: sql`${schema.aiUsage.tokensIn} + ${tin}`, tokensOut: sql`${schema.aiUsage.tokensOut} + ${tout}` } });
}

type Applied = { versionId: string; version: number; previousVersion: number | null; previousVersionId: string | null; diff: string[]; normalizeReport: unknown[]; ruleSummary: { id: string; pass: boolean; severity: string; title: string }[]; metrics: Record<string, unknown> };
type NotApplied = { failures: RuleCheck[]; spec: unknown; reason: string };

export async function runMentor(input: MentorInput) {
  const { user } = input;
  const mode = aiMode();
  const isAdmin = user.role === 'admin';
  if (!mode.demo && !mode.configured) throw new ApiError(503, 'ai_unconfigured', isAdmin ? 'AI isn’t configured yet — add your Azure or OpenAI keys to .env (see README), or set AI_MOCK=1 for the demo mentor.' : 'The mentor isn’t set up yet — ask your coach.');
  const limits = await checkLimits(user);
  const message = (input.chipId && CHIP_PROMPTS[input.chipId] && !input.message ? CHIP_PROMPTS[input.chipId] : input.message).slice(0, 4000);
  const now = new Date();

  // thread
  let thread = input.threadId ? await db.query.chatThreads.findFirst({ where: and(eq(schema.chatThreads.id, input.threadId), eq(schema.chatThreads.userId, user.id)) }) : undefined;
  if (!thread) {
    const id = newId();
    await db.insert(schema.chatThreads).values({ id, userId: user.id, buildId: input.buildId ?? null, title: message.slice(0, 60), createdAt: now, updatedAt: now });
    thread = (await db.query.chatThreads.findFirst({ where: eq(schema.chatThreads.id, id) }))!;
  }
  const buildId = input.buildId ?? thread.buildId ?? null;
  if (buildId && thread.buildId !== buildId) await db.update(schema.chatThreads).set({ buildId }).where(eq(schema.chatThreads.id, thread.id));

  // user message (retry re-uses the saved one)
  let userMsgId = input.retryMessageId;
  if (!userMsgId) {
    userMsgId = newId();
    await db.insert(schema.chatMessages).values({ id: userMsgId, threadId: thread.id, role: 'user', content: message, createdAt: now });
  }

  // crisis guard: caring reply, no robotics, optional coach flag
  if (CRISIS.test(message)) {
    const id = newId();
    await db.insert(schema.chatMessages).values({ id, threadId: thread.id, role: 'assistant', content: CRISIS_REPLY, envelope: fallbackEnvelope(CRISIS_REPLY) as unknown as Record<string, unknown>, target: 'safety', createdAt: new Date() });
    const esc = (await db.query.settingsKv.findFirst({ where: eq(schema.settingsKv.key, 'safety.escalateToCoach') }))?.value;
    if (esc === true) { await db.insert(schema.aiFlags).values({ id: newId(), messageId: userMsgId, userId: user.id, reason: 'safety', createdAt: new Date() }); await notifyRoles(['admin'], { type: 'ai.flag', title: 'A mentor message needs a coach check-in', link: '/settings/ai' }); }
    return { threadId: thread.id, message: await messageView(id), pending: {}, remaining: limits.remaining };
  }

  const history = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.threadId, thread.id)).orderBy(asc(schema.chatMessages.createdAt));
  const { ctx, intents } = await buildContext({ user, message, buildId, chipId: input.chipId, codeFileId: input.codeContext?.fileId, summary: thread.summary });
  if (!buildId && input.mode === 'create') ctx.NEW_BUILD_NAME = 'New Robot';
  const hasBuildVersion = buildId ? !!(await getVersion(buildId)) : false;
  const callMode: Mode = input.mode === 'create' ? 'create' : intents.design && buildId ? 'design' : 'chat';

  const prior = history.filter((m) => m.id !== userMsgId).slice(-16);
  const turns: ChatMsg[] = prior.map((m) => {
    if (m.role === 'assistant') {
      const a = m.applied as { version?: number; diff?: string[] } | null;
      return { role: 'assistant' as const, content: m.content + (a?.version ? `\n[applied design v${a.version}: ${(a.diff ?? []).slice(0, 2).join('; ')}]` : '') };
    }
    return { role: 'user' as const, content: m.content };
  });
  const messages: ChatMsg[] = [
    { role: 'system', content: MENTOR_SYSTEM },
    { role: 'system', content: `CONTEXT: ${JSON.stringify(ctx)}` },
    ...(thread.summary ? [{ role: 'system' as const, content: `Earlier in this conversation: ${thread.summary}` }] : []),
    ...turns,
    { role: 'user', content: message + (input.mode === 'create' ? '\n\n(Create mode: robotSpec is required.)' : '') },
  ];

  let envl: EnvelopeT;
  let meta = { target: 'demo', model: 'demo-mentor', tokensIn: 0, tokensOut: 0, latencyMs: 400 };
  const repairCall = async (extra: string, prev: string) => {
    const r = await callModel([...messages, { role: 'assistant', content: prev.slice(0, 12000) }, { role: 'user', content: extra }], callMode === 'chat' ? 'repair' : callMode, input.signal);
    meta.tokensIn += r.tokensIn; meta.tokensOut += r.tokensOut;
    return r.content;
  };
  try {
    if (mode.demo) {
      await new Promise((r) => setTimeout(r, 400));
      envl = demoEnvelope(ctx, message, input.mode === 'create' ? 'create' : 'chat');
    } else {
      const r = await callModel(messages, callMode, input.signal);
      meta = { target: r.target, model: r.model, tokensIn: r.tokensIn, tokensOut: r.tokensOut, latencyMs: r.latencyMs };
      let parsed = parseEnvelope(r.content);
      let raw = r.content;
      if (!parsed.ok) {
        raw = await repairCall(`${REPAIR_JSON}\nSchema error: ${parsed.error}`, raw);
        parsed = parseEnvelope(raw);
      }
      if (!parsed.ok && input.mode === 'create') {
        raw = await repairCall('robotSpec is required in create mode. Return ONLY the JSON object.', raw);
        parsed = parseEnvelope(raw);
      }
      envl = parsed.ok ? parsed.env : fallbackEnvelope(raw.replace(/[{}"]/g, '').slice(0, 2000));
      if (input.mode === 'create' && !envl.robotSpec) {
        const again = parseEnvelope(await repairCall('robotSpec is required in create mode. Return the full JSON again including a complete robotSpec.', raw));
        if (again.ok && again.env.robotSpec) envl = again.env;
      }
    }
  } catch (e) {
    if (e instanceof AiError && e.kind === 'filtered') envl = fallbackEnvelope(SAFE_FILTERED);
    else if (e instanceof AiError) throw new ApiError(503, 'ai_unavailable', 'The mentor is taking a quick break — the AI service is busy. Your message is saved; tap Retry in a minute.', { retryMessageId: userMsgId, threadId: thread.id });
    else throw e;
  }

  // design pipeline
  let applied: Applied | null = null;
  let notApplied: NotApplied | null = null;
  const assistantId = newId();
  if (envl.robotSpec && buildId) {
    let specInput: unknown = envl.robotSpec;
    let attempt = 0;
    let derived: Awaited<ReturnType<typeof tryDerive>> | null = null;
    while (attempt < 3) {
      try {
        derived = await tryDerive(hasBuildVersion ? buildId : null, specInput);
        const fails = failingErrors(derived.ruleChecks);
        if (!fails.length) break;
        if (attempt === 2 || mode.demo) { notApplied = { failures: fails, spec: derived.spec, reason: 'rules' }; derived = null; break; }
        const fix = await repairCall(`The robotSpec breaks these rules: ${fails.map((f) => `${f.id}: ${f.title} — ${f.detail}`).join(' | ')}. Return the full JSON again with a corrected robotSpec.`, JSON.stringify(envl));
        const p = parseEnvelope(fix);
        if (p.ok && p.env.robotSpec) { envl = { ...p.env }; specInput = p.env.robotSpec; }
        else { notApplied = { failures: fails, spec: derived.spec, reason: 'rules' }; derived = null; break; }
      } catch (e) {
        if (!(e instanceof SpecValidationError) || attempt === 2 || mode.demo) { notApplied = { failures: [{ id: 'spec.invalid', severity: 'error', pass: false, title: 'The design was not a valid RobotSpec', detail: (e as Error).message }], spec: null, reason: 'invalid' }; derived = null; break; }
        const fix = await repairCall(`The robotSpec is not valid: ${e.message}. Return the full JSON again with a corrected robotSpec.`, JSON.stringify(envl));
        const p = parseEnvelope(fix);
        if (p.ok && p.env.robotSpec) { envl = p.env; specInput = p.env.robotSpec; } else break;
      }
      attempt++;
    }
    if (derived) {
      const prevRow = hasBuildVersion ? await getVersion(buildId) : null;
      const v = await createVersion({ buildId, specInput: derived.spec, source: 'ai', authorId: user.id, messageId: assistantId, changeSummary: envl.changeSummary, quiet: true });
      const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, buildId) });
      applied = {
        versionId: v.id, version: v.version, previousVersion: prevRow?.version ?? null, previousVersionId: prevRow?.id ?? null, diff: v.diff,
        normalizeReport: v.derived.normalizeReport, ruleSummary: v.derived.ruleChecks.map((c) => ({ id: c.id, pass: c.pass, severity: c.severity, title: c.title })),
        metrics: { startSize: v.derived.metrics.startSize, motorPowerW: v.derived.metrics.motorPowerW, topSpeedInPerS: v.derived.metrics.topSpeedInPerS, weightLb: v.derived.metrics.weightLb },
      };
      await logActivity({ type: 'ai.design', actorId: user.id, entityType: 'build', entityId: buildId, data: { build: b?.name ?? 'the robot', firstName: firstName(user.displayName), top: v.diff[0] ?? '' }, privateTo: b?.visibility === 'private' ? b.ownerId : null });
    }
  }

  // memory ops
  const memoryNotes: { id: string; text: string; op: string }[] = [];
  if (user.prefs.memoryEnabled !== false) {
    for (const op of envl.memory.slice(0, 2)) {
      if (op.op === 'forget') {
        const target = op.id ? { id: op.id, text: '' } : op.text ? await findMemory(user.id, op.text) : null;
        if (target) { await forgetMemory(user.id, target.id); memoryNotes.push({ id: target.id, text: target.text || op.text || '', op: 'forget' }); }
      } else if (op.text) {
        const r = await addMemory(user.id, { category: op.category ?? 'preference', text: op.text, importance: op.importance, sourceMessageId: assistantId });
        if ('id' in r) memoryNotes.push({ id: r.id, text: op.text, op: r.updated ? 'update' : 'add' });
      }
    }
  }

  await db.insert(schema.chatMessages).values({
    id: assistantId, threadId: thread.id, role: 'assistant', content: envl.reply,
    envelope: { ...envl, robotSpec: envl.robotSpec ? '[spec]' : null, memoryNotes } as unknown as Record<string, unknown>,
    applied: (applied ?? (notApplied ? { notApplied } : null)) as unknown as Record<string, unknown>,
    target: meta.target, model: meta.model, tokensIn: meta.tokensIn, tokensOut: meta.tokensOut, latencyMs: meta.latencyMs, createdAt: new Date(),
  });
  await recordUsage(user.id, meta.tokensIn, meta.tokensOut);

  // auto-title after the first reply; summarize long threads
  if (history.length <= 1) {
    const title = message.replace(/\s+/g, ' ').split(' ').slice(0, 6).join(' ').replace(/[?.!,]+$/, '');
    await db.update(schema.chatThreads).set({ title: title.charAt(0).toUpperCase() + title.slice(1) }).where(eq(schema.chatThreads.id, thread.id));
  }
  await db.update(schema.chatThreads).set({ updatedAt: new Date() }).where(eq(schema.chatThreads.id, thread.id));
  if (history.length > 24 && !mode.demo) summarizeThread(thread.id).catch(() => {});

  return { threadId: thread.id, message: await messageView(assistantId), remaining: limits.remaining };
}

async function summarizeThread(threadId: string) {
  const msgs = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.threadId, threadId)).orderBy(asc(schema.chatMessages.createdAt));
  const older = msgs.slice(0, Math.max(0, msgs.length - 16));
  if (!older.length) return;
  const r = await callModel([{ role: 'system', content: SUMMARIZE }, { role: 'user', content: older.map((m) => `${m.role}: ${m.content}`).join('\n').slice(0, 20000) }], 'summarize');
  const p = (() => { try { return JSON.parse(r.content).summary as string; } catch { return r.content; } })();
  await db.update(schema.chatThreads).set({ summary: String(p).slice(0, 1200) }).where(eq(schema.chatThreads.id, threadId));
}

export async function messageView(id: string) {
  const m = await db.query.chatMessages.findFirst({ where: eq(schema.chatMessages.id, id) });
  if (!m) return null;
  return {
    id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.getTime(), envelope: m.envelope, applied: m.applied, pendingDone: m.pendingDone,
    feedback: m.feedback, flagged: m.flagged, model: m.model, target: m.target,
  };
}

export async function threadMessages(threadId: string) {
  const rows = await db.select().from(schema.chatMessages).where(eq(schema.chatMessages.threadId, threadId)).orderBy(asc(schema.chatMessages.createdAt));
  return rows.map((m) => ({ id: m.id, role: m.role, content: m.content, createdAt: m.createdAt.getTime(), envelope: m.envelope, applied: m.applied, pendingDone: m.pendingDone, feedback: m.feedback, flagged: m.flagged, model: m.model, target: m.target }));
}

export async function listThreads(userId: string) {
  return db.select({ id: schema.chatThreads.id, title: schema.chatThreads.title, buildId: schema.chatThreads.buildId, updatedAt: schema.chatThreads.updatedAt }).from(schema.chatThreads).where(and(eq(schema.chatThreads.userId, userId), eq(schema.chatThreads.archived, false))).orderBy(desc(schema.chatThreads.updatedAt));
}
