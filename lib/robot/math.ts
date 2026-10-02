export type Vec3 = [number, number, number];
export type Mat3 = [number, number, number, number, number, number, number, number, number]; // row-major

export const v = {
  add: (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a: Vec3) => Math.hypot(a[0], a[1], a[2]),
  norm: (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

export const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
export const snap = (n: number, step = 0.5) => Math.round(n / step) * step;
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const DEG = Math.PI / 180;

/** rotation matrix from Euler XYZ (three.js convention: M = Rx · Ry · Rz) */
export function eulerToMat([x, y, z]: Vec3): Mat3 {
  const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
  const ae = a * e, af = a * f, be = b * e, bf = b * f;
  return [c * e, -c * f, d, af + be * d, ae - bf * d, -b * c, bf - ae * d, be + af * d, a * c];
}

/** Euler XYZ from rotation matrix (three.js Euler.setFromRotationMatrix, order XYZ) */
export function matToEuler(m: Mat3): Vec3 {
  const m11 = m[0], m12 = m[1], m13 = m[2], m22 = m[4], m23 = m[5], m32 = m[7], m33 = m[8];
  const y = Math.asin(clamp(m13, -1, 1));
  let x: number, z: number;
  if (Math.abs(m13) < 0.9999999) { x = Math.atan2(-m23, m33); z = Math.atan2(-m12, m11); }
  else { x = Math.atan2(m32, m22); z = 0; }
  return [r4(x), r4(y), r4(z)];
}

/** build a rotation whose local axes map to the given world directions (columns) */
export function basisToEuler(xAxis: Vec3, yAxis: Vec3, zAxis: Vec3): Vec3 {
  return matToEuler([xAxis[0], yAxis[0], zAxis[0], xAxis[1], yAxis[1], zAxis[1], xAxis[2], yAxis[2], zAxis[2]]);
}

/** orientation for a member running along `dir` (local +Z) with local +Y pointing toward `up` */
export function orient(dir: Vec3, up: Vec3): Vec3 {
  const z = v.norm(dir);
  let y = v.sub(up, v.mul(z, v.dot(up, z)));
  if (v.len(y) < 1e-6) y = Math.abs(z[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  y = v.norm(y);
  const x = v.cross(y, z);
  return basisToEuler(x, y, z);
}

export function applyMat(m: Mat3, p: Vec3): Vec3 {
  return [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
}

export interface AABB { min: Vec3; max: Vec3 }

export function transformBox(local: AABB, pos: Vec3, rot: Vec3): AABB {
  const m = eulerToMat(rot);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const c: Vec3 = [i & 1 ? local.max[0] : local.min[0], i & 2 ? local.max[1] : local.min[1], i & 4 ? local.max[2] : local.min[2]];
    const w = v.add(applyMat(m, c), pos);
    for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], w[k]); max[k] = Math.max(max[k], w[k]); }
  }
  return { min, max };
}

export function unionBox(boxes: AABB[]): AABB {
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const b of boxes) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], b.min[k]); max[k] = Math.max(max[k], b.max[k]); }
  return { min, max };
}

export function overlapDepth(a: AABB, b: AABB): number {
  let d = Infinity;
  for (let k = 0; k < 3; k++) d = Math.min(d, Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
  return d;
}
