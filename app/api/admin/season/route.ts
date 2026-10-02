import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { clearDerivedCache } from '@/lib/services/builds';

export const runtime = 'nodejs';

export const GET = route({ role: 'admin' }, async () => {
  const rows = await db.select().from(schema.seasonProfiles);
  return { profiles: rows.map((r) => ({ id: r.id, name: r.name, program: r.program, years: r.years, active: r.active, rules: r.rules })) };
});

const Field = z.object({ value: z.unknown(), ruleRef: z.string().max(20).optional(), verified: z.boolean(), note: z.string().max(300).optional() });
const Body = z.object({
  id: z.string(),
  activate: z.boolean().optional(),
  rules: z.object({
    name: z.string().min(1).max(80),
    manualUrl: z.string().url().max(300).optional().or(z.literal('')),
    qnaUrl: z.string().url().max(300).optional().or(z.literal('')),
    rules: z.record(z.string(), Field),
    match: z.object({ field: z.string().max(40), autonomousSec: z.number().min(0).max(120), driverSec: z.number().min(0).max(600), verified: z.boolean() }).optional(),
    notes: z.string().max(2000).optional(),
  }).passthrough().optional(),
});

/** Edit a season profile (values + "verified" flags) and/or make it the active season. */
export const PUT = route({ role: 'admin', body: Body }, async ({ body }) => {
  const row = await db.query.seasonProfiles.findFirst({ where: eq(schema.seasonProfiles.id, body.id) });
  if (!row) throw notFound('Unknown season profile.');
  if (body.rules) {
    const merged = { ...(row.rules as Record<string, unknown>), ...body.rules, rules: { ...((row.rules as { rules?: object }).rules ?? {}), ...body.rules.rules } };
    await db.update(schema.seasonProfiles).set({ rules: merged, name: body.rules.name }).where(eq(schema.seasonProfiles.id, row.id));
  }
  if (body.activate) {
    await db.update(schema.seasonProfiles).set({ active: false }).where(eq(schema.seasonProfiles.program, row.program));
    await db.update(schema.seasonProfiles).set({ active: true }).where(eq(schema.seasonProfiles.id, row.id));
  }
  clearDerivedCache();
  return { ok: true };
});
