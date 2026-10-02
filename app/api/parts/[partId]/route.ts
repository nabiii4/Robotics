import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { canEditBuild } from '@/lib/services/builds';
import { partView } from '@/lib/services/parts';
import { withDefaults } from '@/lib/printing/templates';

export const runtime = 'nodejs';

async function load(partId: string, user: { id: string; role: string }) {
  const p = await db.query.customParts.findFirst({ where: eq(schema.customParts.id, partId) });
  if (!p || !(await canEditBuild(p.buildId, user))) throw notFound('That part no longer exists.');
  return p;
}

export const GET = route<{ partId: string }>({}, async ({ params, user }) => ({ part: await partView(await load(params.partId, user)) }));

const Patch = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  material: z.enum(['PLA', 'PETG', 'ABS', 'ASA', 'TPU']).optional(),
  color: z.string().max(20).optional(),
  defaultQty: z.number().int().min(1).max(50).optional(),
  purpose: z.string().max(200).nullable().optional(),
  legality: z.enum(['practice', 'decoration', 'license_plate', 'vexu_vai_only']).optional(),
});

export const PATCH = route<{ partId: string }, typeof Patch>({ body: Patch }, async ({ params, user, body }) => {
  const p = await load(params.partId, user);
  const set: Partial<typeof schema.customParts.$inferInsert> = { ...body, updatedAt: new Date() };
  if (body.params) set.params = p.template === 'custom-stl' ? {} : withDefaults(p.template, { ...p.params, ...body.params });
  await db.update(schema.customParts).set(set).where(eq(schema.customParts.id, p.id));
  return { ok: true };
});

export const DELETE = route<{ partId: string }>({}, async ({ params, user }) => {
  const p = await load(params.partId, user);
  const active = await db.select({ id: schema.printJobs.id }).from(schema.printJobs).where(and(eq(schema.printJobs.customPartId, p.id), inArray(schema.printJobs.status, ['queued', 'printing', 'paused'])));
  if (active.length) throw bad('This part is in the print queue. Cancel those jobs first.');
  await db.delete(schema.customParts).where(eq(schema.customParts.id, p.id));
  return { ok: true };
});
