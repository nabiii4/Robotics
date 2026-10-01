import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound, forbidden, atLeast } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params }) => {
  const c = await db.query.competitions.findFirst({ where: eq(schema.competitions.id, params.id) });
  if (!c) throw notFound('That event no longer exists.');
  return { competition: { ...c, createdAt: c.createdAt.getTime() } };
});

const Patch = z.object({
  name: z.string().trim().min(1).max(120).optional(), shortName: z.string().trim().min(1).max(40).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')), location: z.string().trim().max(160).nullable().optional(), program: z.enum(['V5RC', 'VEXU', 'VAIRC']).optional(),
  url: z.string().trim().url().max(300).nullable().optional().or(z.literal('')), notes: z.string().max(2000).nullable().optional(),
  packing: z.array(z.object({ text: z.string().trim().min(1).max(120), done: z.boolean() })).max(80).optional(),
  matchNotes: z.string().max(10000).nullable().optional(),
  results: z.object({ rank: z.string().max(40).optional(), awards: z.string().max(200).optional(), notes: z.string().max(2000).optional() }).nullable().optional(),
});

export const PATCH = route<{ id: string }, typeof Patch>({ body: Patch }, async ({ params, body, user }) => {
  const c = await db.query.competitions.findFirst({ where: eq(schema.competitions.id, params.id) });
  if (!c) throw notFound('That event no longer exists.');
  const detailKeys = ['name', 'shortName', 'startDate', 'endDate', 'location', 'program', 'url', 'notes', 'results'] as const;
  if (detailKeys.some((k) => body[k] !== undefined) && !atLeast(user, 'captain')) throw forbidden('Only captains and admins edit event details. Anyone can update the packing list and match notes.');
  await db.update(schema.competitions).set({ ...body, ...(body.endDate !== undefined ? { endDate: body.endDate || null } : {}), ...(body.url !== undefined ? { url: body.url || null } : {}) }).where(eq(schema.competitions.id, c.id));
  return { ok: true };
});

export const DELETE = route<{ id: string }>({ role: 'captain' }, async ({ params }) => {
  await db.update(schema.tasks).set({ competitionId: null }).where(eq(schema.tasks.competitionId, params.id));
  await db.delete(schema.competitions).where(eq(schema.competitions.id, params.id));
  return { ok: true };
});
