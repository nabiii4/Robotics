import 'server-only';
import { desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { checkLowStock, isLowItem } from './inventory';
import { logActivity } from './activity';
import { bad, notFound } from '../api';

export const CATS = ['screws_hardware', 'vex_structural', 'motors_electronics', 'printed_parts'] as const;
export type Cat = (typeof CATS)[number];

export async function listItems() {
  const items = await db.select().from(schema.inventoryItems).orderBy(schema.inventoryItems.name);
  const res = await db.select().from(schema.inventoryReservations);
  const orders = await db.select().from(schema.orders).where(inArray(schema.orders.status, ['requested', 'ordered']));
  return items.map((i) => {
    const reserved = res.filter((r) => r.itemId === i.id).reduce((s, r) => s + r.qty, 0);
    return {
      id: i.id, name: i.name, sku: i.sku, category: i.category, subcategory: i.subcategory, unit: i.unit, qtyOnHand: i.qtyOnHand, minQty: i.minQty, location: i.location, supplier: i.supplier, url: i.url,
      catalogPartId: i.catalogPartId, notes: i.notes, reserved, available: Math.max(0, i.qtyOnHand - reserved), onOrder: orders.filter((o) => o.itemId === i.id).reduce((s, o) => s + o.qty, 0),
      low: isLowItem(i), out: i.qtyOnHand === 0, updatedAt: i.updatedAt.getTime(),
    };
  });
}

export async function adjustItem(id: string, delta: number, reason: string | null, actorId: string) {
  const it = await db.query.inventoryItems.findFirst({ where: eq(schema.inventoryItems.id, id) });
  if (!it) throw notFound('That item no longer exists.');
  const qty = it.qtyOnHand + delta;
  if (qty < 0) throw bad(`Only ${it.qtyOnHand} on hand.`);
  const now = new Date();
  await db.update(schema.inventoryItems).set({ qtyOnHand: qty, updatedAt: now }).where(eq(schema.inventoryItems.id, id));
  await db.insert(schema.inventoryHistory).values({ id: newId(), itemId: id, delta, reason, actorId, createdAt: now });
  await checkLowStock({ ...it, qtyOnHand: qty });
  return { qtyOnHand: qty, item: it };
}

/** throttle "added to inventory" activity to one line per user per item per 30 min */
export async function logInventoryActivity(actorId: string, itemId: string, delta: number, name: string, subcategory: string) {
  if (delta <= 0) return;
  const recent = await db.select().from(schema.activity).where(eq(schema.activity.entityId, itemId)).orderBy(desc(schema.activity.createdAt)).limit(1);
  if (recent[0] && recent[0].actorId === actorId && Date.now() - recent[0].createdAt.getTime() < 30 * 60_000) return;
  await logActivity({ type: 'inventory.added', actorId, entityType: 'item', entityId: itemId, data: { subcategory: subcategory || name.toLowerCase(), qty: delta >= 10 ? delta : undefined } });
}

const CSV_COLS = ['name', 'sku', 'category', 'subcategory', 'unit', 'qty_on_hand', 'min_qty', 'location', 'supplier', 'url', 'notes'] as const;
export const csvEscape = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export async function exportCsv() {
  const items = await db.select().from(schema.inventoryItems).orderBy(schema.inventoryItems.category, schema.inventoryItems.name);
  const lines = [CSV_COLS.join(',')];
  for (const i of items) lines.push([i.name, i.sku, i.category, i.subcategory, i.unit, i.qtyOnHand, i.minQty, i.location, i.supplier, i.url, i.notes].map(csvEscape).join(','));
  return lines.join('\n') + '\n';
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x.trim())) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}

const CAT_ALIASES: Record<string, Cat> = { screws: 'screws_hardware', hardware: 'screws_hardware', screws_hardware: 'screws_hardware', structural: 'vex_structural', structure: 'vex_structural', vex_structural: 'vex_structural', motors: 'motors_electronics', electronics: 'motors_electronics', motors_electronics: 'motors_electronics', printed: 'printed_parts', printed_parts: 'printed_parts', '3d': 'printed_parts' };

/** Import rows using a column mapping {field: columnIndex}. Matches existing items by SKU, then name; updates them, else creates. */
export async function importRows(rows: string[][], mapping: Partial<Record<(typeof CSV_COLS)[number], number>>, actorId: string, dryRun: boolean) {
  const items = await db.select().from(schema.inventoryItems);
  const out = { created: 0, updated: 0, skipped: [] as { row: number; reason: string }[], preview: [] as Record<string, unknown>[] };
  const get = (r: string[], k: (typeof CSV_COLS)[number]) => (mapping[k] != null ? (r[mapping[k]!] ?? '').trim() : '');
  for (let n = 0; n < rows.length; n++) {
    const r = rows[n];
    const name = get(r, 'name');
    if (!name) { out.skipped.push({ row: n + 1, reason: 'missing name' }); continue; }
    const catRaw = get(r, 'category').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_|_$/g, '');
    const category = CAT_ALIASES[catRaw] ?? CAT_ALIASES[catRaw.split('_')[0]] ?? 'vex_structural';
    const qty = Number(get(r, 'qty_on_hand') || 0), min = Number(get(r, 'min_qty') || 0);
    if (!Number.isFinite(qty) || qty < 0 || !Number.isFinite(min) || min < 0) { out.skipped.push({ row: n + 1, reason: 'bad quantity' }); continue; }
    const sku = get(r, 'sku') || null;
    const existing = items.find((i) => (sku && i.sku === sku) || i.name.toLowerCase() === name.toLowerCase());
    const values = { name: name.slice(0, 120), sku, category, subcategory: get(r, 'subcategory').slice(0, 60), unit: get(r, 'unit') || 'pcs', qtyOnHand: Math.round(qty), minQty: Math.round(min), location: get(r, 'location') || null, supplier: get(r, 'supplier') || null, url: get(r, 'url') || null, notes: get(r, 'notes') || null };
    if (out.preview.length < 8) out.preview.push({ ...values, action: existing ? 'update' : 'create' });
    if (dryRun) { if (existing) out.updated++; else out.created++; continue; }
    const now = new Date();
    if (existing) {
      await db.update(schema.inventoryItems).set({ ...values, updatedAt: now }).where(eq(schema.inventoryItems.id, existing.id));
      if (values.qtyOnHand !== existing.qtyOnHand) await db.insert(schema.inventoryHistory).values({ id: newId(), itemId: existing.id, delta: values.qtyOnHand - existing.qtyOnHand, reason: 'CSV import', actorId, createdAt: now });
      out.updated++;
    } else {
      const id = newId();
      await db.insert(schema.inventoryItems).values({ id, ...values, createdAt: now, updatedAt: now });
      await db.insert(schema.inventoryHistory).values({ id: newId(), itemId: id, delta: values.qtyOnHand, reason: 'CSV import', actorId, createdAt: now });
      out.created++;
    }
  }
  return out;
}
export { CSV_COLS };
