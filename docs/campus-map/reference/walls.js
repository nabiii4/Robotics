// walls.js — wall centre-lines (with door gaps) for one floor of school.json. Pure ES module (no DOM).
// Returns [{x1, z1, x2, z2}] segments; extrude each into a box (data.wallThickness x data.wallHeight).
const SNAP = 0.05;
const snap = (v) => Math.round(v / SNAP) * SNAP;

export function buildWalls(floor, data) {
  const walls = new Map(), gaps = new Map();       // "h:<z>" / "v:<x>" -> [[from, to], ...]
  const put = (map, x1, z1, x2, z2) => {
    [x1, z1, x2, z2] = [x1, z1, x2, z2].map(snap);
    const horiz = Math.abs(z1 - z2) < 1e-6;
    if (!horiz && Math.abs(x1 - x2) > 1e-6) return;  // plan walls are axis-aligned
    const k = horiz ? `h:${z1.toFixed(2)}` : `v:${x1.toFixed(2)}`;
    const [a, b] = horiz ? [x1, x2] : [z1, z2];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push([Math.min(a, b), Math.max(a, b)]);
  };
  const rectPts = (s) => s.poly ?? [[s.x, s.z], [s.x + s.w, s.z], [s.x + s.w, s.z + s.d], [s.x, s.z + s.d]];

  // 1) every space outline is a wall (shared edges are merged below)
  for (const s of floor.spaces) {
    const p = rectPts(s);
    p.forEach((a, i) => { const b = p[(i + 1) % p.length]; put(walls, a[0], a[1], b[0], b[1]); });
  }
  // 2) the main building outline, and the two long sides of exterior link corridors
  const { w: W, d: D } = data.footprint;
  put(walls, 0, 0, W, 0); put(walls, W, 0, W, D); put(walls, 0, D, W, D); put(walls, 0, 0, 0, D);
  for (const c of floor.corridors) {
    if (c.walk === 'z') { put(walls, c.x, c.z, c.x, c.z + c.d); put(walls, c.x + c.w, c.z, c.x + c.w, c.z + c.d); }
    if (c.walk === 'x') { put(walls, c.x, c.z, c.x + c.w, c.z); put(walls, c.x, c.z + c.d, c.x + c.w, c.z + c.d); }
  }
  // 3) door gaps: a doorWidth opening centred on each door; `via` rooms open into their suite room instead
  const half = data.doorWidth / 2;
  for (const s of floor.spaces) {
    if (!s.door) continue;
    if (s.via) {
      const v = floor.spaces.find((o) => o.id === s.via);
      const e = sharedEdge(s, v);
      if (e) put(gaps, ...centred(e, half));
      continue;
    }
    const [x, z, side] = s.door;
    if (side === 'N' || side === 'S') put(gaps, x - half, z, x + half, z);
    else put(gaps, x, z - half, x, z + half);
  }
  // 4) explicit openings (passages through the outline, link corridors meeting annexes)
  for (const o of floor.openings) put(gaps, ...o);

  // 5) union the intervals on each line, subtract the gaps, emit segments
  const out = [];
  for (const [k, list] of walls) {
    const merged = union(list);
    const cuts = union(gaps.get(k) ?? []);
    const pos = Number(k.slice(2));
    for (const [a, b] of subtract(merged, cuts)) {
      if (b - a < 0.1) continue;
      out.push(k[0] === 'h' ? { x1: a, z1: pos, x2: b, z2: pos } : { x1: pos, z1: a, x2: pos, z2: b });
    }
  }
  return out;
}

function union(list) {
  const s = [...list].sort((p, q) => p[0] - q[0]), out = [];
  for (const [a, b] of s) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1e-6) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}
function subtract(segs, cuts) {
  let cur = segs.map((s) => [...s]);
  for (const [c0, c1] of cuts) {
    const next = [];
    for (const [a, b] of cur) {
      if (c1 <= a || c0 >= b) { next.push([a, b]); continue; }
      if (c0 > a) next.push([a, c0]);
      if (c1 < b) next.push([c1, b]);
    }
    cur = next;
  }
  return cur;
}
function sharedEdge(r, s) {           // the overlapping part of two touching rectangles' common side
  const ax1 = r.x + r.w, az1 = r.z + r.d, bx1 = s.x + s.w, bz1 = s.z + s.d;
  const zo = [Math.max(r.z, s.z), Math.min(az1, bz1)], xo = [Math.max(r.x, s.x), Math.min(ax1, bx1)];
  if (Math.abs(ax1 - s.x) < 0.11 || Math.abs(bx1 - r.x) < 0.11) {
    const x = Math.abs(ax1 - s.x) < 0.11 ? ax1 : r.x;
    return zo[1] > zo[0] ? [x, zo[0], x, zo[1]] : null;
  }
  if (Math.abs(az1 - s.z) < 0.11 || Math.abs(bz1 - r.z) < 0.11) {
    const z = Math.abs(az1 - s.z) < 0.11 ? az1 : r.z;
    return xo[1] > xo[0] ? [xo[0], z, xo[1], z] : null;
  }
  return null;
}
function centred([x1, z1, x2, z2], half) {
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  return z1 === z2 ? [cx - half, cz, cx + half, cz] : [cx, cz - half, cx, cz + half];
}
