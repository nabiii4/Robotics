import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { listItems, logInventoryActivity } from '@/lib/services/inventoryItems';
import { ItemBody } from '@/lib/schemas';
import { inventoryMetrics, checkLowStock } from '@/lib/services/inventory';

export const runtime = 'nodejs';

export const GET = route({}, async () => ({ items: await listItems(), metrics: await inventoryMetrics() }));


export const POST = route({ body: ItemBody }, async ({ user, body }) => {
  const id = newId();
  const now = new Date();
  const row = { id, ...body, sku: body.sku || null, url: body.url || null, location: body.location || null, supplier: body.supplier || null, notes: body.notes || null, createdAt: now, updatedAt: now };
  await db.insert(schema.inventoryItems).values(row);
  if (body.qtyOnHand) await db.insert(schema.inventoryHistory).values({ id: newId(), itemId: id, delta: body.qtyOnHand, reason: 'Added item', actorId: user.id, createdAt: now });
  await logInventoryActivity(user.id, id, body.qtyOnHand || 1, body.name, body.subcategory);
  await checkLowStock({ ...row, catalogPartId: null, wasLow: false });
  return { id };
});
