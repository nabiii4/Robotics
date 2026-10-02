import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { readiness } from '@/lib/services/readiness';

export const runtime = 'nodejs';

export const GET = route({}, async ({ req }) => {
  const r = await readiness(req.nextUrl.searchParams.get('competition'));
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName, avatarColor: schema.users.avatarColor }).from(schema.users);
  return {
    percent: r.percent, categories: r.categories, target: r.target,
    tasks: r.tasks.map((t) => ({ id: t.id, title: t.title, category: t.category, status: t.status, weight: t.weight, dueDate: t.dueDate, assignee: users.find((u) => u.id === t.assigneeId) ?? null })),
  };
});
