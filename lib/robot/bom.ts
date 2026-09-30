import { CATALOG, type InventoryCategory } from './catalog';
import type { PartInstance } from './generator';

export interface BomRow {
  key: string;
  partId: string;
  name: string;
  sku?: string;
  qty: number;
  plannedQty: number;
  inventoryCategory: InventoryCategory;
  hardware: boolean;
  detail?: string;
}

function detailFor(p: PartInstance): string | undefined {
  const pr = p.params ?? {};
  const bits: string[] = [];
  if (pr.holes) bits.push(`${pr.holes} holes (${Number(pr.holes) * 0.5}″)`);
  if (pr.teeth) bits.push(`${pr.teeth}T`);
  if (pr.d && p.partId !== 'standoff' && p.partId !== 'pneumatic-cylinder' && p.partId !== 'air-tank') bits.push(`${pr.d}″`);
  if (pr.hand) bits.push(`hand ${pr.hand}`);
  if (pr.cartridge) bits.push(`${pr.cartridge} cartridge`);
  if (pr.len && (p.partId.startsWith('shaft') || p.partId === 'standoff')) bits.push(`${pr.len}″`);
  if (pr.stroke) bits.push(`${pr.stroke} mm stroke`);
  if (pr.w && pr.l && p.partId !== 'decal-plate') bits.push(`${pr.w}″ × ${pr.l}″`);
  return bits.length ? bits.join(', ') : undefined;
}

export function buildBom(parts: PartInstance[]): BomRow[] {
  const map = new Map<string, BomRow>();
  for (const p of parts) {
    const cat = CATALOG[p.partId];
    let row = map.get(p.bomKey);
    if (!row) {
      row = {
        key: p.bomKey, partId: p.partId, name: cat?.name ?? p.partId, sku: cat?.sku, qty: 0, plannedQty: 0,
        inventoryCategory: cat?.inventory ?? 'vex_structural', hardware: !!cat?.hardware, detail: detailFor(p),
      };
      map.set(p.bomKey, row);
    }
    if (p.ghost) row.plannedQty++;
    else row.qty++;
  }
  const order = (r: BomRow) => (r.hardware ? 3 : r.inventoryCategory === 'motors_electronics' ? 1 : r.partId.startsWith('c-channel') ? 0 : 2);
  return [...map.values()].sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

export function bomCsv(rows: BomRow[]): string {
  const esc = (s: string | number | undefined) => { const t = String(s ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const lines = ['item,part,detail,sku,qty,planned_qty,category'];
  rows.forEach((r, i) => lines.push([i + 1, r.name, r.detail, r.sku, r.qty, r.plannedQty, r.inventoryCategory].map(esc).join(',')));
  return lines.join('\n') + '\n';
}
