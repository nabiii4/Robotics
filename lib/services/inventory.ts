import { inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { notifyRoles } from './activity';

export const isLowItem = (i: { qtyOnHand: number; minQty: number }) => i.minQty > 0 && i.qtyOnHand <= i.minQty;

export async function inventoryMetrics() {
  const items = await db.select().from(schema.inventoryItems);
  const open = await db.select().from(schema.orders).where(inArray(schema.orders.status, ['requested', 'ordered']));
  const byCat: Record<string, number> = { screws_hardware: 0, vex_structural: 0, motors_electronics: 0, printed_parts: 0 };
  for (const i of items) byCat[i.category] = (byCat[i.category] ?? 0) + i.qtyOnHand;
  return {
    total: items.length,
    low: items.filter(isLowItem).length,
    out: items.filter((i) => i.qtyOnHand === 0).length,
    onOrder: open.length,
    byCategory: byCat,
  };
}

/** notify captains/admins once when an item crosses into low stock */
export async function checkLowStock(item: typeof schema.inventoryItems.$inferSelect) {
  const low = isLowItem(item);
  const { eq } = await import('drizzle-orm');
  if (low && !item.wasLow) {
    await notifyRoles(['admin', 'captain'], { type: 'inventory.low', title: `Low stock: ${item.name}`, body: `${item.qtyOnHand} left (minimum ${item.minQty})`, link: `/parts?item=${item.id}` });
  }
  if (low !== item.wasLow) await db.update(schema.inventoryItems).set({ wasLow: low }).where(eq(schema.inventoryItems.id, item.id));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an|vex|v5)\b/g, ' ').replace(/\s+/g, ' ').trim();

/** BOM compare (spec §19): match by catalog part id, then SKU, then normalized name. */
export async function bomCompare(buildId: string, bom: { key: string; partId: string; name: string; sku?: string; qty: number }[]) {
  const items = await db.select().from(schema.inventoryItems);
  const res = await db.select().from(schema.inventoryReservations);
  const orders = await db.select().from(schema.orders).where(inArray(schema.orders.status, ['requested', 'ordered']));
  return bom.map((r) => {
    const item = items.find((i) => i.catalogPartId && i.catalogPartId === r.partId)
      ?? (r.sku ? items.find((i) => i.sku && i.sku.toLowerCase() === r.sku!.toLowerCase()) : undefined)
      ?? items.find((i) => norm(i.name) === norm(r.name));
    const reservedHere = item ? res.filter((x) => x.itemId === item.id && x.buildId === buildId).reduce((s, x) => s + x.qty, 0) : 0;
    const reservedOther = item ? res.filter((x) => x.itemId === item.id && x.buildId !== buildId).reduce((s, x) => s + x.qty, 0) : 0;
    const onHand = item?.qtyOnHand ?? 0;
    const available = Math.max(0, onHand - reservedOther);
    const onOrder = orders.filter((o) => (item && o.itemId === item.id) || norm(o.name) === norm(r.name)).reduce((s, o) => s + o.qty, 0);
    return { key: r.key, partId: r.partId, name: r.name, sku: r.sku ?? item?.sku ?? null, need: r.qty, itemId: item?.id ?? null, itemName: item?.name ?? null, onHand, reserved: reservedHere, available, short: Math.max(0, r.qty - available), onOrder };
  });
}
