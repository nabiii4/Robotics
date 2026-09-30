import { CATALOG, channelProfile, MOTOR_11W_SIZE, MOTOR_55W_SIZE } from '../catalog';
import type { RobotSpec } from '../spec';
import { orient, r4, v, type AABB, type Vec3 } from '../math';

export interface PartInstance {
  uid: string;
  partId: string;
  params?: Record<string, number | string>;
  position: Vec3;
  rotation: Vec3;
  subsystemId: string;
  step: number;
  color?: string;
  ghost?: boolean;
  bomKey: string;
  label?: string;
}

export interface Collision { a: string; b: string; message: string }
export interface AssemblyStep { index: number; title: string; instruction: string; partUids: string[]; checks: string[]; notes?: string[] }

export interface Frame {
  L: number; zF: number; zR: number;
  axleY: number; wheelR: number; wheelW: number;
  webBottom: number; railTop: number; crossTop: number;
  innerX: number; outerX: number; railX: number; sideX: number;
  towerX: number;
  radioSpot?: Vec3;
  anchors: Record<string, Vec3>;
  notes: string[];
}

export const STEP = {
  frame: 1, wheels: 2, driveMotors: 3, electronics: 4, subsystemBase: 5,
} as const;

export function bomKeyFor(partId: string, params?: Record<string, number | string>): string {
  if (!params) return partId;
  const keys: string[] = [];
  if (params.holes != null) keys.push(`${params.holes}h`);
  if (params.teeth != null) keys.push(`${params.teeth}T`);
  if (params.d != null && partId !== 'standoff') keys.push(`${params.d}in`);
  if (params.len != null && (partId === 'standoff' || partId.startsWith('shaft'))) keys.push(`${params.len}in`);
  if (params.cartridge) keys.push(String(params.cartridge));
  if (params.hand) keys.push(String(params.hand));
  if (params.stroke) keys.push(`${params.stroke}mm`);
  return keys.length ? `${partId}:${keys.join(':')}` : partId;
}

export class Gen {
  parts: PartInstance[] = [];
  private counters = new Map<string, number>();
  constructor(public spec: RobotSpec, public pose: number, public showHardware = true) {}

  get metal() { return this.spec.appearance.metal === 'steel' ? 'st' : 'al'; }
  channelId(profile: string) { return `c-channel-${profile}-${this.metal}`; }

  add(sub: string, role: string, partId: string, pos: Vec3, rot: Vec3, o: { params?: Record<string, number | string>; step: number; color?: string; ghost?: boolean; label?: string }) {
    const key = `${sub}:${role}`;
    const i = this.counters.get(key) ?? 0;
    this.counters.set(key, i + 1);
    const p: PartInstance = {
      uid: `${key}:${i}`, partId, position: [r4(pos[0]), r4(pos[1]), r4(pos[2])], rotation: rot, subsystemId: sub, step: o.step,
      bomKey: bomKeyFor(partId, o.params),
    };
    if (o.params) p.params = o.params;
    if (o.color) p.color = o.color;
    if (o.ghost) p.ghost = true;
    if (o.label) p.label = o.label;
    this.parts.push(p);
    return p;
  }

  /** structural member along from→to (web centre line), flanges pointing toward `up`; adds joint hardware */
  member(sub: string, role: string, partId: string, from: Vec3, to: Vec3, up: Vec3, o: { step: number; ghost?: boolean; label?: string; hardware?: boolean }) {
    const dir = v.sub(to, from);
    const len = v.len(dir);
    const holes = Math.max(2, Math.round(len / 0.5));
    const mid = v.lerp(from, to, 0.5);
    const rot = orient(dir, up);
    const n = channelProfile(partId);
    const p = this.add(sub, role, partId, mid, rot, { params: { holes, n }, step: o.step, ghost: o.ghost, label: o.label });
    if (o.hardware !== false) {
      const z = v.norm(dir);
      let y = v.sub(up, v.mul(z, v.dot(up, z)));
      y = v.len(y) < 1e-6 ? [0, 1, 0] : v.norm(y);
      const x = v.cross(y, z);
      const L = holes * 0.5;
      for (const end of [-1, 1]) {
        const c = v.add(mid, v.mul(z, end * (L / 2 - 0.25)));
        const offs = n >= 2 ? [-0.25, 0.25] : [0];
        for (const off of offs) {
          const sp = v.add(c, v.mul(x, off));
          this.add(sub, 'screw', 'screw-8-32', sp, rot, { step: o.step, ghost: o.ghost });
          this.add(sub, 'nut', 'nut-nylock', v.add(sp, v.mul(y, 0.08)), rot, { step: o.step, ghost: o.ghost });
        }
      }
    }
    return p;
  }

  plate(sub: string, role: string, partId: string, center: Vec3, rot: Vec3, w: number, l: number, o: { step: number; ghost?: boolean; t?: number; color?: string; label?: string; text?: string }) {
    const params: Record<string, number | string> = { w: r4(w), l: r4(l), t: o.t ?? 0.064 };
    if (o.text) params.text = o.text;
    return this.add(sub, role, partId, center, rot, { params, step: o.step, ghost: o.ghost, color: o.color, label: o.label });
  }

  shaft(sub: string, x0: number, x1: number, y: number, z: number, o: { step: number; ghost?: boolean; hs?: boolean }) {
    const len = Math.abs(x1 - x0);
    this.add(sub, 'shaft', o.hs === false ? 'shaft-std' : 'shaft-hs', [(x0 + x1) / 2, y, z], [0, 0, 0], { params: { len: r4(Math.round(len * 4) / 4) }, step: o.step, ghost: o.ghost });
    for (const x of [Math.min(x0, x1) + 0.08, Math.max(x0, x1) - 0.08]) this.add(sub, 'collar', 'collar', [x, y, z], [0, 0, 0], { step: o.step, ghost: o.ghost });
  }
}

export function motorSize(partId: string): [number, number, number] {
  return partId === 'motor-5.5w' ? MOTOR_55W_SIZE : MOTOR_11W_SIZE;
}

/** local-frame bounding box of a part instance (inches) */
export function localBox(p: PartInstance): AABB {
  const cat = CATALOG[p.partId];
  const pr = p.params ?? {};
  const n = (k: string, d = 0) => (typeof pr[k] === 'number' ? (pr[k] as number) : d);
  const box = (x: number, y: number, z: number, cy = 0): AABB => ({ min: [-x / 2, cy - y / 2, -z / 2], max: [x / 2, cy + y / 2, z / 2] });
  switch (cat?.render) {
    case 'channel': {
      const w = n('n', 2) * 0.5, L = n('holes', 2) * 0.5;
      return { min: [-w / 2, 0, -L / 2], max: [w / 2, 0.5, L / 2] };
    }
    case 'angle': { const L = n('holes', 2) * 0.5; return { min: [-0.5, 0, -L / 2], max: [0.5, 1, L / 2] }; }
    case 'plate': return box(n('w', 1), n('t', 0.064), n('l', 1));
    case 'decal': return box(n('w', 3), n('h', 1.2), 0.06);
    case 'shaft': { const s = p.partId === 'shaft-hs' ? 0.25 : 0.125; return box(n('len', 2), s, s); }
    case 'wheel': return box(n('w', 1), n('d', 4), n('d', 4));
    case 'roller': return box(n('len', 10), n('d', 2), n('d', 2));
    case 'gear': case 'sprocket': { const od = n('teeth', 12) / 24 + 2 / 24; return box(n('face', 0.5), od, od); }
    case 'chain': return box(0.12, 0.12, n('len', 1));
    case 'band': return box(0.06, 0.06, n('len', 1));
    case 'motor': { const s = motorSize(p.partId); return box(s[0], s[1], s[2]); }
    case 'cylinder': return box(n('d', 0.6), n('d', 0.6), n('len', 3));
    case 'standoff': return box(0.25, n('len', 1), 0.25);
    case 'screw': case 'nut': case 'collar': return box(0.2, 0.2, 0.2);
    case 'box': { const s = cat.size ?? [1, 1, 1]; return box(s[0], s[1], s[2]); }
    default: return box(0.5, 0.5, 0.5);
  }
}

export const isHardware = (p: PartInstance) => !!CATALOG[p.partId]?.hardware;
