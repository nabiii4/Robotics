import 'server-only';
import { TEMPLATE_BY_ID, withDefaults, PITCH, SCREW_HOLE, SHAFT_14, SHAFT_18, type ParamValue } from './templates';

/* eslint-disable @typescript-eslint/no-explicit-any */
type M = any;
let wasmP: Promise<any> | null = null;
async function wasm() {
  if (!wasmP) {
    wasmP = (async () => {
      const mod = await import('manifold-3d');
      const w = await (mod.default as any)();
      w.setup();
      return w;
    })();
  }
  return wasmP;
}

const COMP = 0.2; // hole compensation (mm), per-printer default

export interface PartMesh {
  positions: Float32Array; // xyz per vertex
  indices: Uint32Array;
  volumeMm3: number;
  areaMm2: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  status: string;
}

function holeCyl(W: any, d: number, h: number) {
  return W.Manifold.cylinder(h, (d + COMP) / 2, (d + COMP) / 2, 32, true);
}
function squareHole(W: any, s: number, h: number) {
  return W.Manifold.cube([s + COMP, s + COMP, h], true);
}
function boreFor(W: any, bore: string, h: number) {
  if (bore === 'shaft-1/4') return squareHole(W, SHAFT_14, h);
  if (bore === 'shaft-1/8') return squareHole(W, SHAFT_18, h);
  return holeCyl(W, SCREW_HOLE, h);
}
function union(W: any, list: M[]): M {
  return list.length === 1 ? list[0] : W.Manifold.union(list);
}
/** grid of vertical holes over [nx × ny] holes at the VEX pitch, starting half a pitch in */
function holeGrid(W: any, nx: number, ny: number, h: number, style = 'round-8-32', z0 = 0): M[] {
  const out: M[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const hole = style === 'square-0.182' ? squareHole(W, 4.62, h + 2) : holeCyl(W, SCREW_HOLE, h + 2);
    out.push(hole.translate([PITCH / 2 + i * PITCH, PITCH / 2 + j * PITCH, z0 + h / 2]));
  }
  return out;
}

function gearProfile(teeth: number): [number, number][] {
  const m = 1.0583;
  const rp = (teeth * m) / 2, ro = rp + m, rr = rp - 1.25 * m;
  const p = (2 * Math.PI) / teeth;
  const pts: [number, number][] = [];
  for (let t = 0; t < teeth; t++) {
    const b = t * p;
    for (const [r, f] of [[rr, -0.5], [rr, -0.3], [ro, -0.13], [ro, 0.13], [rr, 0.3]] as const) pts.push([r * Math.cos(b + f * p), r * Math.sin(b + f * p)]);
  }
  return pts;
}

function build(W: any, id: string, p: Record<string, ParamValue>): M {
  const n = (k: string) => Number(p[k]);
  switch (id) {
    case 'u-bracket': {
      const L = n('lengthHoles') * PITCH, Wd = n('widthHoles') * PITCH, T = n('thicknessMm'), H = n('wallHeightMm');
      let body = union(W, [W.Manifold.cube([L, Wd, T]), W.Manifold.cube([T, Wd, H]), W.Manifold.cube([T, Wd, H]).translate([L - T, 0, 0])]);
      body = body.subtract(union(W, holeGrid(W, n('lengthHoles'), n('widthHoles'), T, String(p.holeStyle))));
      const wallHoles: M[] = [];
      for (let k = 0; PITCH / 2 + T + k * PITCH + SCREW_HOLE / 2 < H; k++) for (let j = 0; j < n('widthHoles'); j++) {
        wallHoles.push(holeCyl(W, SCREW_HOLE, L + 4).rotate([0, 90, 0]).translate([L / 2, PITCH / 2 + j * PITCH, T + PITCH / 2 + k * PITCH]));
      }
      if (wallHoles.length) body = body.subtract(union(W, wallHoles));
      return body;
    }
    case 'l-bracket': {
      const A = n('legAHoles') * PITCH, B = n('legBHoles') * PITCH, Wd = n('widthHoles') * PITCH, T = n('thicknessMm');
      const parts: M[] = [W.Manifold.cube([A + T, Wd, T]), W.Manifold.cube([T, Wd, B + T])];
      if (p.gusset) {
        const cs = new W.CrossSection([[[T, T], [T + Math.min(A, B) * 0.6, T], [T, T + Math.min(A, B) * 0.6]]]);
        const g = cs.extrude(2.4).rotate([90, 0, 0]);
        parts.push(g.translate([0, 2.4, 0]), g.translate([0, Wd, 0]));
      }
      let body = union(W, parts);
      body = body.subtract(union(W, holeGrid(W, n('legAHoles'), n('widthHoles'), T).map((h) => h.translate([T, 0, 0]))));
      const bh: M[] = [];
      for (let i = 0; i < n('legBHoles'); i++) for (let j = 0; j < n('widthHoles'); j++) bh.push(holeCyl(W, SCREW_HOLE, T * 3).rotate([0, 90, 0]).translate([T / 2, PITCH / 2 + j * PITCH, T + PITCH / 2 + i * PITCH]));
      return body.subtract(union(W, bh));
    }
    case 'gusset-bracket': {
      const A = n('legAHoles') * PITCH, B = n('legBHoles') * PITCH, T = n('thicknessMm'), ang = n('angleDeg');
      const Wd = PITCH;
      let legA = W.Manifold.cube([A, Wd, T]).subtract(union(W, holeGrid(W, n('legAHoles'), 1, T)));
      let legB = W.Manifold.cube([B, Wd, T]).subtract(union(W, holeGrid(W, n('legBHoles'), 1, T)));
      legB = legB.rotate([0, -ang, 0]);
      const a = (ang * Math.PI) / 180;
      const r = 0.75;
      const tri: [number, number][] = [[0, 0], [A * r, 0], [B * r * Math.cos(a), B * r * Math.sin(a)]];
      let web = new W.CrossSection([tri]).extrude(T).rotate([90, 0, 0]).translate([0, T, 0]);
      if (n('lighteningHoleMm') > 0) {
        const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cz = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
        web = web.subtract(W.Manifold.cylinder(T * 4, n('lighteningHoleMm') / 2, n('lighteningHoleMm') / 2, 32, true).rotate([90, 0, 0]).translate([cx, T / 2, cz]));
      }
      return union(W, [legA, legB, web]);
    }
    case 'spacer': {
      const h = n('lengthMm');
      return W.Manifold.cylinder(h, n('odMm') / 2, n('odMm') / 2, 48).subtract(boreFor(W, String(p.bore), h * 3));
    }
    case 'spur-gear': {
      const face = n('faceWidthMm');
      let g = new W.CrossSection([gearProfile(n('teeth'))]).extrude(face);
      if (n('hubOdMm') > 0 && n('hubLengthMm') > 0) g = g.add(W.Manifold.cylinder(n('hubLengthMm'), n('hubOdMm') / 2, n('hubOdMm') / 2, 48).translate([0, 0, face]));
      return g.subtract(boreFor(W, String(p.bore), (face + n('hubLengthMm')) * 3));
    }
    case 'sensor-mount': {
      const sizes: Record<string, [number, number, number]> = { inertial: [38, 38, 14], rotation: [46, 46, 14], optical: [26, 26, 12], distance: [48, 26, 16], custom: [40, 30, 14] };
      const [sx, sy, sz] = sizes[String(p.sensor)] ?? sizes.custom;
      const w = n('wallMm');
      const outer = W.Manifold.cube([sx + 2 * w, sy + 2 * w, sz * 0.6 + w]);
      let tray = outer.subtract(W.Manifold.cube([sx + COMP, sy + COMP, sz]).translate([w - COMP / 2, w - COMP / 2, w]));
      if (p.windowCutout) tray = tray.subtract(W.Manifold.cube([sx * 0.6, sy * 0.6, w * 4], true).translate([w + sx / 2, w + sy / 2, 0]));
      const holes = Math.max(1, n('mountHoles'));
      const tabL = holes * PITCH;
      let tab = W.Manifold.cube([tabL, PITCH * 1.2, w + 1]).translate([(sx + 2 * w - tabL) / 2, sy + 2 * w, 0]);
      tab = tab.subtract(union(W, holeGrid(W, holes, 1, w + 1).map((h) => h.translate([(sx + 2 * w - tabL) / 2, sy + 2 * w + PITCH * 0.1, 0]))));
      return tray.add(tab);
    }
    case 'plate': {
      const T = n('thicknessMm');
      return W.Manifold.cube([n('holesX') * PITCH, n('holesY') * PITCH, T]).subtract(union(W, holeGrid(W, n('holesX'), n('holesY'), T)));
    }
    case 'cable-guide': {
      const wd = n('widthMm');
      let base = W.Manifold.cube([wd + 16, 14, 3]);
      const arch = W.Manifold.cube([wd, 14, 9]).subtract(W.Manifold.cube([wd - 5, 16, 6.5]).translate([2.5, -1, 0])).translate([8, 0, 0]);
      base = base.add(arch);
      const slots: M[] = [];
      for (let i = 0; i < n('slots'); i++) slots.push(W.Manifold.cube([3, 5, 10]).translate([2.5 + (i % 2) * (wd + 8), 4.5, -2]));
      return base.subtract(union(W, slots));
    }
    case 'license-plate-holder': {
      const pw = n('plateWidthMm'), ph = n('plateHeightMm');
      const frame = W.Manifold.cube([pw + 8, ph + 8, 4]).subtract(W.Manifold.cube([pw - 8, ph - 8, 10]).translate([8, 8, -2]));
      const lip = W.Manifold.cube([pw + 8, 3, 7]).translate([0, 0, 0]);
      return frame.add(lip).subtract(union(W, [holeCyl(W, SCREW_HOLE, 12).translate([4, (ph + 8) / 2, 2]), holeCyl(W, SCREW_HOLE, 12).translate([pw + 4, (ph + 8) / 2, 2])]));
    }
    default:
      return W.Manifold.cube([20, 20, 5]);
  }
}

const meshCache = new Map<string, PartMesh>();

export async function partMesh(templateId: string, params: Record<string, ParamValue>): Promise<PartMesh> {
  if (!TEMPLATE_BY_ID[templateId]) throw new Error(`Unknown template ${templateId}`);
  const p = withDefaults(templateId, params);
  const key = `${templateId}:${JSON.stringify(p)}`;
  const hit = meshCache.get(key);
  if (hit) return hit;
  const W = await wasm();
  const man = build(W, templateId, p);
  const mesh = man.getMesh();
  const np = mesh.numProp;
  const count = mesh.vertProperties.length / np;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { positions[i * 3] = mesh.vertProperties[i * np]; positions[i * 3 + 1] = mesh.vertProperties[i * np + 1]; positions[i * 3 + 2] = mesh.vertProperties[i * np + 2]; }
  const bb = man.boundingBox();
  const out: PartMesh = {
    positions, indices: new Uint32Array(mesh.triVerts), volumeMm3: man.volume(), areaMm2: man.surfaceArea(),
    bbox: { min: [bb.min[0], bb.min[1], bb.min[2]], max: [bb.max[0], bb.max[1], bb.max[2]] }, status: String(man.status()),
  };
  if (meshCache.size > 100) meshCache.clear();
  meshCache.set(key, out);
  return out;
}

/** Binary STL in mm (spec §17.2) */
export function toStl(mesh: { positions: Float32Array; indices: Uint32Array }, name: string): Buffer {
  const tris = mesh.indices.length / 3;
  const buf = Buffer.alloc(84 + tris * 50);
  buf.write(`FDRHS Robotics Hub - ${name}`.slice(0, 80), 0, 'ascii');
  buf.writeUInt32LE(tris, 80);
  const P = mesh.positions;
  for (let t = 0; t < tris; t++) {
    const a = mesh.indices[t * 3] * 3, b = mesh.indices[t * 3 + 1] * 3, c = mesh.indices[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const o = 84 + t * 50;
    buf.writeFloatLE(nx, o); buf.writeFloatLE(ny, o + 4); buf.writeFloatLE(nz, o + 8);
    for (let k = 0; k < 3; k++) { const i = [a, b, c][k]; buf.writeFloatLE(P[i], o + 12 + k * 12); buf.writeFloatLE(P[i + 1], o + 16 + k * 12); buf.writeFloatLE(P[i + 2], o + 20 + k * 12); }
    buf.writeUInt16LE(0, o + 48);
  }
  return buf;
}

/** Parse binary or ASCII STL into positions/indices (non-indexed) */
export function parseStl(buf: Buffer): { positions: Float32Array; indices: Uint32Array } {
  const isAscii = buf.slice(0, 5).toString('ascii') === 'solid' && buf.includes(Buffer.from('facet'));
  if (!isAscii) {
    const tris = buf.readUInt32LE(80);
    const positions = new Float32Array(tris * 9);
    for (let t = 0; t < tris; t++) for (let k = 0; k < 9; k++) positions[t * 9 + k] = buf.readFloatLE(84 + t * 50 + 12 + k * 4);
    return { positions, indices: Uint32Array.from({ length: tris * 3 }, (_, i) => i) };
  }
  const nums = [...buf.toString('ascii').matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].flatMap((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
  const positions = Float32Array.from(nums);
  return { positions, indices: Uint32Array.from({ length: nums.length / 3 }, (_, i) => i) };
}

export function meshStats(mesh: { positions: Float32Array; indices: Uint32Array }) {
  let vol = 0, area = 0;
  const P = mesh.positions;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[i + k]); max[k] = Math.max(max[k], P[i + k]); }
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = mesh.indices[t] * 3, b = mesh.indices[t + 1] * 3, c = mesh.indices[t + 2] * 3;
    vol += (P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c])) / 6;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
  }
  return { volumeMm3: Math.abs(vol), areaMm2: area, bbox: { min, max } };
}
