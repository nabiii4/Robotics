import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound, bad, forbidden, atLeast } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { adjustItem } from '@/lib/services/inventoryItems';
import { logActivity, notify } from '@/lib/services/activity';
import { newId } from '@/lib/ids';

export const runtime = 'nodejs';

const FLOW: Record<string, string[]> = { requested: ['ordered', 'received', 'canceled'], ordered: ['received', 'canceled'], received: [], canceled: ['requested'] };

export const PATCH = route<{ id: string }, z.ZodTypeAny>({ body: z.object({ status: z.enum(['requested', 'ordered', 'received', 'canceled']).optional(), qty: z.number().int().min(1).max(10000).optional(), eta: z.string().max(20).nullable().optional() }) }, async ({ params, body, user }) => {
  const b = body as { status?: string; qty?: number; eta?: string | null };
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, params.id) });
  if (!o) throw notFound('That order line no longer exists.');
  if (b.status && !atLeast(user, 'captain')) throw forbidden('Only captains and admins change order status.');
  if (b.status && b.status !== o.status && !FLOW[o.status].includes(b.status)) throw bad(`Can’t go from ${o.status} to ${b.status}.`);
  if ((b.qty || b.eta !== undefined) && o.requestedBy !== user.id && !atLeast(user, 'captain')) throw forbidden();
  const now = new Date();
  await db.update(schema.orders).set({ ...(b.status ? { status: b.status as 'requested' } : {}), ...(b.qty ? { qty: b.qty } : {}), ...(b.eta !== undefined ? { eta: b.eta } : {}), updatedBy: user.id, updatedAt: now }).where(eq(schema.orders.id, o.id));
  if (b.status === 'received' && o.status !== 'received') {
    let itemId = o.itemId;
    if (!itemId) {
      // create the item so the received parts land somewhere
      itemId = newId();
      await db.insert(schema.inventoryItems).values({ id: itemId, name: o.name, sku: o.sku, category: 'vex_structural', subcategory: '', qtyOnHand: 0, minQty: 0, createdAt: now, updatedAt: now });
      await db.update(schema.orders).set({ itemId }).where(eq(schema.orders.id, o.id));
    }
    await adjustItem(itemId, b.qty ?? o.qty, `Order received`, user.id);
    await logActivity({ type: 'order.received', actorId: user.id, entityType: 'order', entityId: o.id, data: { name: o.name, qty: b.qty ?? o.qty } });
    if (o.requestedBy !== user.id) await notify(o.requestedBy, { type: 'order.received', title: `${o.name} arrived`, body: `${b.qty ?? o.qty} added to inventory`, link: '/parts' });
  }
  if (b.status === 'ordered') await logActivity({ type: 'order.ordered', actorId: user.id, entityType: 'order', entityId: o.id, data: { name: o.name, qty: o.qty } });
  return { ok: true };
});

export const DELETE = route<{ id: string }>({}, async ({ params, user }) => {
  const o = await db.query.orders.findFirst({ where: eq(schema.orders.id, params.id) });
  if (!o) throw notFound();
  if (o.requestedBy !== user.id && !atLeast(user, 'captain')) throw forbidden();
  if (o.status !== 'requested' && o.status !== 'canceled') throw bad('Only requested or canceled lines can be removed.');
  await db.delete(schema.orders).where(eq(schema.orders.id, o.id));
  return { ok: true };
});
