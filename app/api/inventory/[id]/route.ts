import { eq } from 'drizzle-orm';
import { route, notFound, forbidden, atLeast } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { ItemBody } from '@/lib/schemas';
import { checkLowStock } from '@/lib/services/inventory';

export const runtime = 'nodejs';
const Patch = ItemBody.partial();

export const PATCH = route<{ id: string }, typeof Patch>({ body: Patch }, async ({ params, body, user }) => {
  const it = await db.query.inventoryItems.findFirst({ where: eq(schema.inventoryItems.id, params.id) });
  if (!it) throw notFound('That item no longer exists.');
  const now = new Date();
  const set = { ...body, updatedAt: now, ...(body.url !== undefined ? { url: body.url || null } : {}), ...(body.sku !== undefined ? { sku: body.sku || null } : {}) };
  await db.update(schema.inventoryItems).set(set).where(eq(schema.inventoryItems.id, it.id));
  if (body.qtyOnHand !== undefined && body.qtyOnHand !== it.qtyOnHand) await db.insert(schema.inventoryHistory).values({ id: newId(), itemId: it.id, delta: body.qtyOnHand - it.qtyOnHand, reason: 'Edited', actorId: user.id, createdAt: now });
  await checkLowStock({ ...it, ...set, url: set.url ?? it.url, sku: set.sku ?? it.sku } as typeof it);
  return { ok: true };
});

export const DELETE = route<{ id: string }>({}, async ({ params, user }) => {
  if (!atLeast(user, 'captain')) throw forbidden('Only captains and admins can delete inventory items.');
  await db.delete(schema.inventoryReservations).where(eq(schema.inventoryReservations.itemId, params.id));
  await db.delete(schema.inventoryHistory).where(eq(schema.inventoryHistory.itemId, params.id));
  await db.delete(schema.inventoryItems).where(eq(schema.inventoryItems.id, params.id));
  return { ok: true };
});
