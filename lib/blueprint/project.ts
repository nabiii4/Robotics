// Orthographic / isometric projection of PartInstances into 2D outlines (spec §16.2).
import type { PartInstance } from '../robot/generator/core';
import { localBox } from '../robot/generator/core';
import { CATALOG } from '../robot/catalog';
import { applyMat, eulerToMat, v, type Vec3 } from '../robot/math';

export type ViewName = 'front' | 'top' | 'right' | 'iso' | 'left';
export interface Shape { uid: string; partId: string; pts: [number, number][]; depth: number; ghost: boolean; circle?: { cx: number; cy: number; r: number }; subsystemId: string }
export interface ViewResult { shapes: Shape[]; min: [number, number]; max: [number, number] }

const ROUND = new Set(['wheel', 'gear', 'sprocket', 'roller', 'cylinder', 'standoff', 'shaft']);

/** world-space outline points for a part (box corners, or rings for round parts) */
function worldPoints(p: PartInstance): Vec3[] {
  const b = localBox(p);
  const m = eulerToMat(p.rotation);
  const cat = CATALOG[p.partId];
  const pts: Vec3[] = [];
  if (cat && ROUND.has(cat.render) && cat.render !== 'shaft') {
    // axis: local X for wheels/gears/rollers/sprockets, Z for cylinders, Y for standoffs
    const axis = cat.render === 'cylinder' ? 2 : cat.render === 'standoff' ? 1 : 0;
    const i = (axis + 1) % 3, j = (axis + 2) % 3;
    const r = Math.min(b.max[i], b.max[j]);
    for (const end of [b.min[axis], b.max[axis]]) {
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        const q: Vec3 = [0, 0, 0];
        q[axis] = end; q[i] = Math.cos(a) * r; q[j] = Math.sin(a) * r;
        pts.push(v.add(applyMat(m, q), p.position));
      }
    }
    return pts;
  }
  for (let k = 0; k < 8; k++) {
    const c: Vec3 = [k & 1 ? b.max[0] : b.min[0], k & 2 ? b.max[1] : b.min[1], k & 4 ? b.max[2] : b.min[2]];
    pts.push(v.add(applyMat(m, c), p.position));
  }
  return pts;
}

export function viewBasis(view: ViewName): { u: Vec3; w: Vec3; dir: Vec3 } {
  // u → drawing x (right), w → drawing y (down), dir → toward the viewer (depth)
  switch (view) {
    case 'front': return { u: [1, 0, 0], w: [0, -1, 0], dir: [0, 0, 1] };
    case 'top': return { u: [1, 0, 0], w: [0, 0, 1], dir: [0, 1, 0] };
    case 'right': return { u: [0, 0, -1], w: [0, -1, 0], dir: [1, 0, 0] };
    case 'left': return { u: [0, 0, 1], w: [0, -1, 0], dir: [-1, 0, 0] };
    default: {
      const az = (-35 * Math.PI) / 180, el = (25 * Math.PI) / 180;
      const c: Vec3 = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
      const fwd = v.mul(c, -1);
      const right = v.norm(v.cross(fwd, [0, 1, 0]));
      const up = v.cross(right, fwd);
      return { u: right, w: v.mul(up, -1), dir: c };
    }
  }
}

function hull(points: [number, number][]): [number, number][] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

export function projectView(parts: PartInstance[], view: ViewName, opts: { hardware?: boolean; ghosts?: boolean } = {}): ViewResult {
  const { u, w, dir } = viewBasis(view);
  const shapes: Shape[] = [];
  const min: [number, number] = [Infinity, Infinity], max: [number, number] = [-Infinity, -Infinity];
  for (const p of parts) {
    const cat = CATALOG[p.partId];
    if (!opts.hardware && cat?.hardware) continue;
    if (!opts.ghosts && p.ghost) continue;
    if (p.partId === 'chain' || p.partId === 'rubber-band') continue;
    const wp = worldPoints(p);
    const pts2 = wp.map((q) => [v.dot(q, u), v.dot(q, w)] as [number, number]);
    const h = hull(pts2);
    if (h.length < 3) continue;
    const depth = v.dot(p.position, dir);
    for (const [x, y] of h) { min[0] = Math.min(min[0], x); min[1] = Math.min(min[1], y); max[0] = Math.max(max[0], x); max[1] = Math.max(max[1], y); }
    shapes.push({ uid: p.uid, partId: p.partId, pts: h, depth, ghost: !!p.ghost, subsystemId: p.subsystemId });
  }
  shapes.sort((a, b) => a.depth - b.depth);
  return { shapes, min, max };
}

export function project3(p: Vec3, view: ViewName): [number, number] {
  const { u, w } = viewBasis(view);
  return [v.dot(p, u), v.dot(p, w)];
}
