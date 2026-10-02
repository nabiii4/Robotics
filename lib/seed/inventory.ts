// Inventory generator from real VEX names (spec §21.4). Quantities are tuned so each scenario's numbers come out exactly.
type Cat = 'screws_hardware' | 'vex_structural' | 'motors_electronics' | 'printed_parts';
export interface SeedItem { name: string; sku?: string; category: Cat; subcategory: string; qty: number; min: number; location: string; catalogPartId?: string }

function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const NAMES: Record<Cat, [string, string, string?, string?][]> = {
  screws_hardware: [
    ['Screw 8-32 × 1/4″', 'screws', '275-1004'], ['Screw 8-32 × 3/8″', 'screws', '275-1005', 'screw-8-32'], ['Screw 8-32 × 1/2″', 'screws', '275-1006'], ['Screw 8-32 × 3/4″', 'screws'], ['Screw 8-32 × 1″', 'screws'],
    ['Screw 8-32 × 1-1/4″', 'screws'], ['Screw 8-32 × 1-1/2″', 'screws'], ['Screw 8-32 × 2″', 'screws'], ['Nylock Nut 8-32', 'nuts', '275-1027', 'nut-nylock'], ['Keps Nut 8-32', 'nuts', '275-1028'],
    ['Shaft Collar (HS)', 'collars', '276-3490', 'collar'], ['Shaft Collar 1/8″', 'collars'], ['Nylon Spacer 1/8″', 'spacers'], ['Nylon Spacer 1/4″', 'spacers'], ['Nylon Spacer 3/8″', 'spacers'],
    ['Nylon Spacer 1/2″', 'spacers'], ['Washer #8 Steel', 'washers'], ['Washer #8 Teflon', 'washers'], ['Standoff 8-32 × 0.5″', 'standoffs', undefined, 'standoff'], ['Standoff 8-32 × 1″', 'standoffs'],
    ['Standoff 8-32 × 1.5″', 'standoffs'], ['Standoff 8-32 × 2″', 'standoffs'], ['Standoff 8-32 × 3″', 'standoffs'], ['Zip Ties 4″', 'zip ties'], ['Zip Ties 8″', 'zip ties'],
    ['Rubber Bands #64', 'rubber bands', undefined, 'rubber-band'], ['Rubber Bands #32', 'rubber bands'], ['Bearing Flat', 'bearings', '276-1209'], ['HS Bearing Flat', 'bearings'], ['Star Drive Screw 8-32 × 1/2″', 'screws'],
  ],
  vex_structural: [
    ['C-Channel 1x2x1x25 (Al)', 'c-channels', '276-2288', 'c-channel-1x2x1-al'], ['C-Channel 1x2x1x35 (Al)', 'c-channels', '276-2288', 'c-channel-1x2x1-al'], ['C-Channel 1x3x1x25 (Al)', 'c-channels', '276-2289', 'c-channel-1x3x1-al'], ['C-Channel 1x3x1x35 (Al)', 'c-channels'], ['C-Channel 1x5x1x25 (Al)', 'c-channels', '276-2290', 'c-channel-1x5x1-al'],
    ['C-Channel 1x2x1x35 (Steel)', 'c-channels', '275-1141', 'c-channel-1x2x1-st'], ['C-Channel 1x5x1x35 (Steel)', 'c-channels'], ['Angle 2x2x25 (Al)', 'angles', undefined, 'angle-2x2-al'], ['Angle 2x2x35 (Al)', 'angles'], ['Plate 5x25 (Al)', 'plates', undefined, 'plate-5xN-al'],
    ['Plate 5x15 (Al)', 'plates'], ['Flat Bar 1x25 (Al)', 'flat bars', undefined, 'flat-bar-1xN-al'], ['Gusset Pack', 'gussets'], ['Pivot Pack', 'pivots'], ['HS Shaft 3″', 'shafts', undefined, 'shaft-hs'],
    ['HS Shaft 6″', 'shafts', undefined, 'shaft-hs'], ['HS Shaft 12″', 'shafts', undefined, 'shaft-hs'], ['Drive Shaft 1/8″ × 4″', 'shafts', undefined, 'shaft-std'], ['Drive Shaft 1/8″ × 12″', 'shafts', undefined, 'shaft-std'], ['Omni Wheel 2.75″', 'wheels', '276-3526', 'omni-wheel'],
    ['Omni Wheel 3.25″', 'wheels', undefined, 'omni-wheel'], ['Omni Wheel 4″', 'wheels', undefined, 'omni-wheel'], ['Traction Wheel 4″', 'wheels', undefined, 'traction-wheel'], ['Traction Wheel 3.25″', 'wheels', undefined, 'traction-wheel'], ['Mecanum Wheel 4″ (pair)', 'wheels', '276-1447', 'mecanum-wheel'],
    ['HS Gear 12T', 'gears', undefined, 'gear-hs'], ['HS Gear 36T', 'gears', undefined, 'gear-hs'], ['HS Gear 48T', 'gears', undefined, 'gear-hs'], ['HS Gear 60T', 'gears', undefined, 'gear-hs'], ['HS Gear 84T', 'gears', undefined, 'gear-hs'],
    ['Sprocket 12T (6P)', 'sprockets', undefined, 'sprocket'], ['Sprocket 24T (6P)', 'sprockets', undefined, 'sprocket'], ['Chain 6P (links)', 'chain', undefined, 'chain'], ['Flex Wheel 2″ 45A', 'flex wheels', undefined, 'flex-wheel'], ['Flex Wheel 2.5″ 60A', 'flex wheels', undefined, 'flex-wheel'],
    ['Polycarbonate Sheet 12×24', 'sheet', undefined, 'poly-plate'],
  ],
  motors_electronics: [
    ['V5 Smart Motor (11W)', 'motors', '276-4840', 'motor-11w'], ['V5 Smart Motor (5.5W)', 'motors', '276-4842', 'motor-5.5w'], ['Gear Cartridge Red 100 rpm', 'cartridges'], ['Gear Cartridge Green 200 rpm', 'cartridges'], ['Gear Cartridge Blue 600 rpm', 'cartridges'],
    ['V5 Robot Brain', 'brains', '276-4810', 'brain'], ['V5 Robot Battery', 'batteries', '276-4811', 'battery'], ['V5 Robot Radio', 'radios', '276-4831', 'radio'], ['V5 Controller', 'controllers'], ['V5 Inertial Sensor', 'sensors', '276-4855', 'inertial'],
    ['V5 Rotation Sensor', 'sensors', '276-6050', 'rotation'], ['V5 Optical Sensor', 'sensors', undefined, 'optical'], ['V5 Distance Sensor', 'sensors', undefined, 'distance'], ['V5 GPS Sensor', 'sensors', undefined, 'gps'], ['Smart Cable 12″', 'cables'],
    ['Smart Cable 24″', 'cables'], ['Smart Cable 36″', 'cables'], ['Pneumatic Air Tank', 'pneumatics', undefined, 'air-tank'], ['Double-Acting Solenoid', 'pneumatics', undefined, 'solenoid'], ['Pneumatic Cylinder 50 mm', 'pneumatics', undefined, 'pneumatic-cylinder'],
  ],
  printed_parts: [
    ['Intake Mount (printed)', 'printed brackets'], ['Gear Spacer 18T (printed)', 'printed gears'], ['Arm Bracket (printed, PETG)', 'printed brackets'], ['Sensor Holder (printed)', 'printed mounts'], ['Cable Guide (printed)', 'printed guides'],
  ],
};

const LOC: Record<Cat, string> = { screws_hardware: 'Bin A (hardware wall)', vex_structural: 'Rack B (metal)', motors_electronics: 'Cabinet C (electronics)', printed_parts: 'Shelf D (printed)' };

/** Distribute `total` units across `n` items with the given low-stock flags, deterministically. */
function spread(n: number, total: number, low: boolean[], rnd: () => number): { qty: number; min: number }[] {
  const out = Array.from({ length: n }, (_, i) => ({ qty: 0, min: low[i] ? 2 + Math.floor(rnd() * 4) : Math.floor(rnd() * 3) }));
  // low items: qty ≤ min
  for (let i = 0; i < n; i++) if (low[i]) out[i].qty = Math.max(0, out[i].min - Math.floor(rnd() * 2));
  let used = out.reduce((s, x) => s + x.qty, 0);
  const normal = out.map((_, i) => i).filter((i) => !low[i]);
  // normal items must stay above min: give each min+1 first
  for (const i of normal) { out[i].qty = out[i].min + 1; used += out[i].qty; }
  let left = total - used;
  if (left < 0) {
    // reduce mins on normal items until it fits
    for (const i of normal) { while (left < 0 && out[i].qty > 1) { out[i].qty--; out[i].min = Math.max(0, Math.min(out[i].min, out[i].qty - 1)); left++; } }
  }
  const weights = normal.map(() => 0.2 + rnd());
  const wsum = weights.reduce((s, x) => s + x, 0) || 1;
  let rem = left;
  normal.forEach((i, k) => { const add = Math.floor((left * weights[k]) / wsum); out[i].qty += add; rem -= add; });
  for (let k = 0; rem > 0 && normal.length; k++, rem--) out[normal[k % normal.length]].qty++;
  return out;
}

export function scenarioInventory(scenario: 'A' | 'B'): SeedItem[] {
  const rnd = mulberry32(2026);
  const items: SeedItem[] = [];
  if (scenario === 'A') {
    // Category unit sums 248 / 36 / 12 / 28 and 3 low-stock items
    const plan: [Cat, number, number, number][] = [['screws_hardware', 12, 248, 1], ['vex_structural', 8, 36, 1], ['motors_electronics', 5, 12, 1], ['printed_parts', 4, 28, 0]];
    for (const [cat, n, total, lowCount] of plan) {
      const names = NAMES[cat].slice(0, n);
      const low = names.map((_, i) => i < lowCount);
      const q = spread(n, total, low, rnd);
      names.forEach(([name, sub, sku, cp], i) => items.push({ name, sku, category: cat, subcategory: sub, qty: q[i].qty, min: q[i].min, location: LOC[cat], catalogPartId: cp }));
    }
    return items;
  }
  // Scenario B: 142 items, 18 low stock
  const counts: [Cat, number, number][] = [['screws_hardware', 52, 6], ['vex_structural', 56, 7], ['motors_electronics', 28, 5], ['printed_parts', 6, 0]];
  for (const [cat, n] of counts) {
    const base = NAMES[cat];
    for (let i = 0; i < n; i++) {
      const [name, sub, sku, cp] = base[i % base.length];
      const variant = Math.floor(i / base.length);
      items.push({ name: variant ? `${name} (${['bin 2', 'spare', 'team 2'][variant - 1] ?? `set ${variant + 1}`})` : name, sku, category: cat, subcategory: sub, qty: 0, min: 0, location: LOC[cat], catalogPartId: cp });
    }
  }
  let idx = 0;
  for (const [cat, n, lowCount] of counts) {
    const slice = items.slice(idx, idx + n);
    slice.forEach((it, i) => {
      const low = i % Math.max(1, Math.floor(n / Math.max(1, lowCount))) === 0 && i / Math.max(1, Math.floor(n / Math.max(1, lowCount))) < lowCount;
      if (low) { it.min = 4 + Math.floor(rnd() * 8); it.qty = Math.max(0, it.min - 1 - Math.floor(rnd() * 3)); }
      else { it.min = cat === 'motors_electronics' ? 1 + Math.floor(rnd() * 2) : 5 + Math.floor(rnd() * 10); it.qty = it.min + 2 + Math.floor(rnd() * (cat === 'screws_hardware' ? 300 : cat === 'printed_parts' ? 10 : 30)); }
    });
    idx += n;
  }
  return items;
}

export const isLow = (i: { qty: number; min: number }) => i.min > 0 && i.qty <= i.min;
