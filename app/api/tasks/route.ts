import { z } from 'zod';
import { desc } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { logActivity, notify } from '@/lib/services/activity';

export const runtime = 'nodejs';

export const GET = route({}, async ({ req }) => {
  const q = req.nextUrl.searchParams;
  let rows = await db.select().from(schema.tasks).orderBy(desc(schema.tasks.createdAt));
  if (q.get('category')) rows = rows.filter((t) => t.category === q.get('category'));
  if (q.get('assignee')) rows = rows.filter((t) => (q.get('assignee') === 'none' ? !t.assigneeId : t.assigneeId === q.get('assignee')));
  if (q.get('build')) rows = rows.filter((t) => t.buildId === q.get('build'));
  if (q.get('competition')) rows = rows.filter((t) => t.competitionId === q.get('competition'));
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName, avatarColor: schema.users.avatarColor }).from(schema.users);
  return {
    tasks: rows.map((t) => ({ ...t, completedAt: t.completedAt?.getTime() ?? null, createdAt: t.createdAt.getTime(), assignee: users.find((u) => u.id === t.assigneeId) ?? null })),
  };
});

const TaskBody = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(['mechanical', 'electronics', 'code', 'testing', 'notebook']),
  status: z.enum(['todo', 'doing', 'done']).default('todo'),
  assigneeId: z.string().nullable().optional(),
  buildId: z.string().nullable().optional(),
  competitionId: z.string().nullable().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().or(z.literal('')),
  weight: z.number().int().min(1).max(5).default(1),
});

export const POST = route({ body: TaskBody }, async ({ user, body }) => {
  const id = newId();
  await db.insert(schema.tasks).values({
    id, title: body.title, category: body.category, status: body.status, assigneeId: body.assigneeId || null, buildId: body.buildId || null,
    competitionId: body.competitionId || null, dueDate: body.dueDate || null, weight: body.weight, completedAt: body.status === 'done' ? new Date() : null, createdBy: user.id, createdAt: new Date(),
  });
  await logActivity({ type: 'task.created', actorId: user.id, entityType: 'task', entityId: id, data: { title: body.title } });
  if (body.assigneeId && body.assigneeId !== user.id) await notify(body.assigneeId, { type: 'task.assigned', title: `New task: ${body.title}`, body: `Assigned by ${user.displayName}`, link: `/team?tab=tasks&task=${id}` });
  return { id };
});
