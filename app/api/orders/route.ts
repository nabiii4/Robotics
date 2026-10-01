import { z } from 'zod';
import { desc } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { logActivity, notifyRoles } from '@/lib/services/activity';

export const runtime = 'nodejs';

export const GET = route({}, async () => {
  const rows = await db.select().from(schema.orders).orderBy(desc(schema.orders.updatedAt)).limit(500);
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName }).from(schema.users);
  const name = (id: string | null) => users.find((u) => u.id === id)?.displayName ?? null;
  return { orders: rows.map((o) => ({ ...o, requestedByName: name(o.requestedBy), updatedByName: name(o.updatedBy), createdAt: o.createdAt.getTime(), updatedAt: o.updatedAt.getTime() })) };
});

export const POST = route({ body: z.object({ itemId: z.string().nullable().optional(), name: z.string().trim().min(1).max(120), sku: z.string().trim().max(40).nullable().optional(), qty: z.number().int().min(1).max(10000) }) }, async ({ body, user }) => {
  const id = newId();
  const now = new Date();
  await db.insert(schema.orders).values({ id, itemId: body.itemId ?? null, name: body.name, sku: body.sku || null, qty: body.qty, status: 'requested', requestedBy: user.id, createdAt: now, updatedAt: now });
  await logActivity({ type: 'order.requested', actorId: user.id, entityType: 'order', entityId: id, data: { name: body.name, qty: body.qty } });
  if (user.role === 'member') await notifyRoles(['captain', 'admin'], { type: 'order.requested', title: `Order request: ${body.qty} × ${body.name}`, body: `From ${user.displayName}`, link: '/parts?tab=orders' });
  return { id };
});
