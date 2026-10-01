import { desc, eq } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params }) => {
  const rows = await db.select().from(schema.inventoryHistory).where(eq(schema.inventoryHistory.itemId, params.id)).orderBy(desc(schema.inventoryHistory.createdAt)).limit(200);
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName }).from(schema.users);
  return { history: rows.map((h) => ({ id: h.id, delta: h.delta, reason: h.reason, actor: users.find((u) => u.id === h.actorId)?.displayName ?? 'Someone', createdAt: h.createdAt.getTime() })) };
});
