import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { canEditBuild, derivedForVersion, getVersion } from './builds';
import { bomCompare } from './inventory';
import { logActivity } from './activity';
import { notFound } from '../api';

export async function compareForBuild(buildId: string, user: { id: string; role: string }) {
  const b = await canEditBuild(buildId, user);
  const v = b ? await getVersion(b.id) : null;
  if (!b || !v) throw notFound('That build doesn’t exist.');
  const d = await derivedForVersion(b.id, v);
  return { build: b, rows: await bomCompare(b.id, d.bom) };
}

/** Replace this build's reservations with min(need, available) for every matched row. */
export async function reserveAll(buildId: string, user: { id: string; role: string }) {
  const { build, rows } = await compareForBuild(buildId, user);
  await db.delete(schema.inventoryReservations).where(eq(schema.inventoryReservations.buildId, build.id));
  let n = 0;
  for (const r of rows) {
    if (!r.itemId) continue;
    const qty = Math.min(r.need, r.available);
    if (qty <= 0) continue;
    await db.insert(schema.inventoryReservations).values({ id: newId(), itemId: r.itemId, buildId: build.id, qty, createdBy: user.id, createdAt: new Date() });
    n++;
  }
  await logActivity({ type: 'inventory.reserved', actorId: user.id, entityType: 'build', entityId: build.id, data: { build: build.name } });
  return { reserved: n };
}

/** Add order lines for shortages not already on order. */
export async function orderShortages(buildId: string, user: { id: string; role: string }) {
  const { rows } = await compareForBuild(buildId, user);
  let n = 0;
  for (const r of rows) {
    const need = r.short - r.onOrder;
    if (need <= 0) continue;
    const existing = r.itemId ? await db.query.orders.findFirst({ where: and(eq(schema.orders.itemId, r.itemId), eq(schema.orders.status, 'requested')) }) : null;
    if (existing) await db.update(schema.orders).set({ qty: existing.qty + need, updatedAt: new Date() }).where(eq(schema.orders.id, existing.id));
    else await db.insert(schema.orders).values({ id: newId(), itemId: r.itemId, name: r.itemName ?? r.name, sku: r.sku, qty: need, status: 'requested', requestedBy: user.id, createdAt: new Date(), updatedAt: new Date() });
    n++;
  }
  return { ordered: n };
}
