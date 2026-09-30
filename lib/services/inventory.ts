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
