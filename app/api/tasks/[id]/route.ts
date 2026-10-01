import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound, forbidden, atLeast } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { logActivity, notify } from '@/lib/services/activity';

export const runtime = 'nodejs';

const Patch = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  category: z.enum(['mechanical', 'electronics', 'code', 'testing', 'notebook']).optional(),
  status: z.enum(['todo', 'doing', 'done']).optional(),
  assigneeId: z.string().nullable().optional(),
  buildId: z.string().nullable().optional(),
  competitionId: z.string().nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  weight: z.number().int().min(1).max(5).optional(),
});

export const PATCH = route<{ id: string }, typeof Patch>({ body: Patch }, async ({ params, body, user }) => {
  const t = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, params.id) });
  if (!t) throw notFound('That task no longer exists.');
  const set: Partial<typeof schema.tasks.$inferInsert> = { ...body, dueDate: body.dueDate === '' ? null : body.dueDate };
  if (body.status && body.status !== t.status) {
    set.completedAt = body.status === 'done' ? new Date() : null;
    if (body.status === 'done') await logActivity({ type: 'task.completed', actorId: user.id, entityType: 'task', entityId: t.id, data: { title: body.title ?? t.title } });
  }
  if (body.assigneeId && body.assigneeId !== t.assigneeId && body.assigneeId !== user.id) await notify(body.assigneeId, { type: 'task.assigned', title: `New task: ${body.title ?? t.title}`, body: `Assigned by ${user.displayName}`, link: `/team?tab=tasks&task=${t.id}` });
  await db.update(schema.tasks).set(set).where(eq(schema.tasks.id, t.id));
  return { ok: true };
});

export const DELETE = route<{ id: string }>({}, async ({ params, user }) => {
  const t = await db.query.tasks.findFirst({ where: eq(schema.tasks.id, params.id) });
  if (!t) throw notFound('That task no longer exists.');
  if (t.createdBy !== user.id && !atLeast(user, 'captain')) throw forbidden('Only the person who made it or a captain can delete this task.');
  await db.delete(schema.tasks).where(eq(schema.tasks.id, t.id));
  return { ok: true };
});
