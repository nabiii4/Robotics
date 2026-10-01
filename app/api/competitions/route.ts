import { z } from 'zod';
import { asc } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { logActivity } from '@/lib/services/activity';
import { readiness } from '@/lib/services/readiness';

export const runtime = 'nodejs';

export const GET = route({}, async () => {
  const rows = await db.select().from(schema.competitions).orderBy(asc(schema.competitions.startDate));
  const out = [];
  for (const c of rows) {
    const r = await readiness(c.id);
    out.push({ id: c.id, name: c.name, shortName: c.shortName, startDate: c.startDate, endDate: c.endDate, location: c.location, program: c.program, url: c.url, isTarget: c.isTarget, results: c.results ?? null, readiness: r.tasks.length ? r.percent : null });
  }
  return { competitions: out };
});

const Body = z.object({
  name: z.string().trim().min(1).max(120), shortName: z.string().trim().min(1).max(40), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  location: z.string().trim().max(160).nullable().optional(), program: z.enum(['V5RC', 'VEXU', 'VAIRC']).default('V5RC'), url: z.string().trim().url().max(300).nullable().optional().or(z.literal('')), notes: z.string().max(2000).nullable().optional(),
});

export const POST = route({ role: 'captain', body: Body }, async ({ body, user }) => {
  const id = newId();
  const packing = ['Robot + spare battery (charged)', 'Controller + spare battery', 'Battery charger', 'Tool box (hex keys, wrenches)', 'Spare motors and cables', 'Engineering notebook', 'Team shirts', 'Zip ties and spare screws'].map((text) => ({ text, done: false }));
  await db.insert(schema.competitions).values({ id, ...body, endDate: body.endDate || null, url: body.url || null, location: body.location || null, notes: body.notes || null, packing, isTarget: false, createdAt: new Date() });
  await logActivity({ type: 'competition.created', actorId: user.id, entityType: 'competition', entityId: id, data: { event: body.shortName } });
  return { id };
});
