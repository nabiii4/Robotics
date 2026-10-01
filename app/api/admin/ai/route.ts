import { z } from 'zod';
import { desc, eq, gte } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { aiMode } from '@/lib/ai/config';
import { targetHealth } from '@/lib/ai/client';
import { env } from '@/lib/env';
import { getSetting, setSetting } from '@/lib/services/settings';

export const runtime = 'nodejs';

export const GET = route({ role: 'admin' }, async () => {
  const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const usage = await db.select().from(schema.aiUsage).where(gte(schema.aiUsage.day, since)).orderBy(desc(schema.aiUsage.day));
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName }).from(schema.users);
  const flags = await db.select().from(schema.aiFlags).orderBy(desc(schema.aiFlags.createdAt)).limit(100);
  const msgs = [];
  for (const f of flags) {
    const m = await db.query.chatMessages.findFirst({ where: eq(schema.chatMessages.id, f.messageId) });
    msgs.push({ id: f.id, status: f.status, reason: f.reason, createdAt: f.createdAt.getTime(), user: users.find((u) => u.id === f.userId)?.displayName ?? 'Someone', content: m?.content?.slice(0, 1200) ?? '(message deleted)', model: m?.model ?? null });
  }
  const e = env();
  return {
    mode: aiMode(), targets: targetHealth(),
    limits: await getSetting('ai.limits', { perHour: e.AI_MAX_REQUESTS_PER_HOUR, perDay: e.AI_MAX_REQUESTS_PER_DAY, teamDaily: e.AI_GLOBAL_DAILY_CAP }),
    escalateToCoach: await getSetting('safety.escalateToCoach', false),
    usage: usage.map((u) => ({ ...u, name: users.find((x) => x.id === u.userId)?.displayName ?? 'Someone' })),
    flags: msgs,
  };
});

export const PATCH = route({ role: 'admin', body: z.object({ limits: z.object({ perHour: z.number().int().min(1).max(1000), perDay: z.number().int().min(1).max(5000), teamDaily: z.number().int().min(1).max(100000) }).optional(), escalateToCoach: z.boolean().optional() }) }, async ({ body }) => {
  if (body.limits) await setSetting('ai.limits', body.limits);
  if (body.escalateToCoach !== undefined) await setSetting('safety.escalateToCoach', body.escalateToCoach);
  return { ok: true };
});
