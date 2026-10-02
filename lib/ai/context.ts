import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { PART_OPTIONS } from '../robot/catalog';
import { compactRules } from '../robot/seasons';
import { activeSeason, derivedForVersion, getVersion } from '../services/builds';
import { firstName } from '../services/activity';
import { isLowItem } from '../services/inventory';
import { retrieveMemories } from './memory';
import { searchKnowledge } from './knowledge';
import type { SessionUser } from '../auth/session';

export const INTENTS = {
  rules: /rule|legal|allowed|inspect|manual|size limit|\b(R|SG|GG|G)\d+\b/i,
  code: /code|program|auton|driver control|error|compile|c\+\+|function|port|pid|odom/i,
  parts: /part|inventory|stock|order|bom|have enough|screw/i,
  print: /print|stl|filament|pla|petg/i,
  design: /make|build|design|change|add|remove|faster|stronger|drive|intake|lift|arm|claw|clamp|wheel|gear|motor|launcher|catapult|flywheel|pneumatic|wider|taller|shorter/i,
};

export function detectIntents(msg: string, chipId?: string) {
  return {
    rules: INTENTS.rules.test(msg) || chipId === 'rules',
    code: INTENTS.code.test(msg) || chipId === 'explain-code' || chipId === 'code-help',
    parts: INTENTS.parts.test(msg),
    print: INTENTS.print.test(msg),
    design: INTENTS.design.test(msg),
  };
}

export async function buildContext(a: { user: SessionUser; message: string; buildId?: string | null; chipId?: string; codeFileId?: string | null; summary?: string | null }) {
  const intents = detectIntents(a.message, a.chipId);
  const ctx: Record<string, unknown> = {};
  ctx.STUDENT = { firstName: firstName(a.user.displayName), teamRole: a.user.teamRole, grade: a.user.grade ?? undefined, replyLength: a.user.prefs.replyLength ?? 'concise' };
  const memOn = a.user.prefs.memoryEnabled !== false;
  if (memOn) ctx.MEMORY = await retrieveMemories(a.user.id, a.message);
  const season = await activeSeason();
  ctx.SEASON_RULES = compactRules(season);
  ctx.PART_OPTIONS = PART_OPTIONS;
  let buildName: string | null = null;
  if (a.buildId) {
    const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, a.buildId) });
    const v = b ? await getVersion(b.id) : null;
    if (b && v) {
      const d = await derivedForVersion(b.id, v);
      buildName = b.name;
      ctx.CURRENT_BUILD = {
        id: b.id, name: b.name, version: v.version, spec: d.spec,
        metrics: { startSize: d.metrics.startSize, weightLb: d.metrics.weightLb, topSpeedInPerS: d.metrics.topSpeedInPerS, wheelRpm: d.metrics.wheelRpm, motorPowerW: d.metrics.motorPowerW, pushLbf: d.metrics.pushLbf, maxHeight: d.metrics.maxHeight },
        failingChecks: d.ruleChecks.filter((c) => !c.pass && c.severity !== 'info').map((c) => ({ id: c.id, severity: c.severity, title: c.title })),
        devices: d.devices.map((x) => ({ name: x.name, type: x.type, port: x.port })),
      };
      if (intents.parts) {
        const items = await db.select().from(schema.inventoryItems);
        const low = items.filter(isLowItem).slice(0, 15).map((i) => ({ name: i.name, onHand: i.qtyOnHand, min: i.minQty }));
        const need = d.bom.filter((r) => !r.hardware).slice(0, 25).map((r) => ({ part: r.name, detail: r.detail, qty: r.qty }));
        ctx.INVENTORY_HINTS = { lowStock: low, bomNeeds: need };
      }
      if (intents.code || a.codeFileId) {
        const files = await db.select().from(schema.codeFiles).where(eq(schema.codeFiles.buildId, b.id)).orderBy(desc(schema.codeFiles.updatedAt));
        const f = (a.codeFileId ? files.find((x) => x.id === a.codeFileId) : null) ?? files.find((x) => !x.generated) ?? files[0];
        const last = await db.select().from(schema.compileResults).where(eq(schema.compileResults.buildId, b.id)).orderBy(desc(schema.compileResults.createdAt)).limit(1);
        if (f) ctx.CODE_CONTEXT = { path: f.path, code: f.content.split('\n').slice(0, 300).map((l, i) => `${i + 1}: ${l}`).join('\n'), diagnostics: last[0]?.diagnostics.slice(0, 10) ?? [] };
      }
    }
  }
  if (intents.rules) {
    const ex = await searchKnowledge(a.message);
    if (ex.length) ctx.RULE_EXCERPTS = ex;
  }
  if (a.summary) ctx.THREAD_SUMMARY = a.summary;
  // trim to ~12k tokens (≈48k chars): inventory → code → rule excerpts
  const size = () => JSON.stringify(ctx).length;
  if (size() > 48000) delete ctx.INVENTORY_HINTS;
  if (size() > 48000 && ctx.CODE_CONTEXT) (ctx.CODE_CONTEXT as { code: string }).code = (ctx.CODE_CONTEXT as { code: string }).code.slice(0, 6000);
  if (size() > 48000 && Array.isArray(ctx.RULE_EXCERPTS)) ctx.RULE_EXCERPTS = (ctx.RULE_EXCERPTS as unknown[]).slice(0, 2);
  return { ctx, intents, buildName, trimmed: size() > 48000 };
}
