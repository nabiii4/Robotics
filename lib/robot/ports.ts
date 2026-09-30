import type { MotorSet, RobotSpec, Subsystem } from './spec';
import { subsystemMotors } from './spec';

export type DeviceType = 'motor' | 'inertial' | 'rotation' | 'optical' | 'distance' | 'gps' | 'ai-vision' | 'radio' | 'piston' | 'bumper' | 'limit';

export interface Device {
  name: string;
  type: DeviceType;
  port: number | string;
  subsystemId: string;
  motorType?: MotorSet['type'];
  cartridge?: MotorSet['cartridge'];
  reversed?: boolean;
  group?: string;
  role?: string;
}

export interface PortReport { device: string; from: number | string; to: number | string; reason: string }

export function camel(s: string): string {
  const parts = s.replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'mech';
  const out = parts.map((p, i) => (i === 0 ? p.charAt(0).toLowerCase() + p.slice(1) : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  return /^[0-9]/.test(out) ? `m${out}` : out;
}

function flat(sets: MotorSet[]): MotorSet[] {
  const out: MotorSet[] = [];
  for (const m of sets) for (let i = 0; i < m.count; i++) out.push({ ...m, count: 1 });
  return out;
}

const DRIVE_NAMES: Record<number, string[]> = {
  1: [''],
  2: ['Front', 'Back'],
  3: ['Front', 'Mid', 'Back'],
  4: ['Front', 'MidFront', 'MidBack', 'Back'],
};

function isPneumatic(s: Subsystem): boolean {
  if (s.type === 'clamp') return s.variant === 'pneumatic-clamp';
  if (s.type === 'intake') return s.pivot === 'pneumatic';
  if (s.type === 'wing' || s.type === 'hood' || s.type === 'hang' || s.type === 'descore-arm') return s.actuation === 'pneumatic';
  return false;
}

/** Assign device names and ports (spec §13.7). Previous ports are kept; portOverrides always win. */
export function assignPorts(spec: RobotSpec, previous?: Device[]): { devices: Device[]; report: PortReport[] } {
  const devices: Device[] = [];
  const dt = spec.drivetrain;
  const perSide = Math.max(1, Math.round(dt.motors.count / 2));
  const names = DRIVE_NAMES[Math.min(4, perSide)] ?? DRIVE_NAMES[2];
  const cart = dt.motors.type === '11W' ? dt.motors.cartridge ?? 'green' : undefined;
  for (const [side, base] of [['left', 1], ['right', 11]] as const) {
    for (let i = 0; i < Math.min(4, perSide); i++) {
      devices.push({ name: `${side}${names[i]}Motor`, type: 'motor', port: base + i, subsystemId: 'drivetrain', motorType: dt.motors.type, cartridge: cart, reversed: side === 'right', group: `${side}Drive`, role: 'drive' });
    }
  }
  if (dt.type === 'hdrive' && dt.hWheel) {
    devices.push({ name: 'strafeMotor', type: 'motor', port: 5, subsystemId: 'drivetrain', motorType: dt.hWheel.motors.type, cartridge: dt.hWheel.motors.type === '11W' ? dt.hWheel.motors.cartridge ?? 'green' : undefined, role: 'strafe' });
  }
  const mechPorts = [6, 7, 8, 9, 10, 15, 16, 17, 18, 19];
  let mp = 0;
  const threeWire: Device[] = [];
  const used = new Set<string>();
  const uniq = (n: string) => { let x = n, k = 2; while (used.has(x)) x = `${n}${k++}`; used.add(x); return x; };
  devices.forEach((d) => used.add(d.name));
  for (const s of spec.subsystems) {
    const base = camel(s.name);
    const ms = flat(subsystemMotors(s));
    if (ms.length === 1) {
      devices.push({ name: uniq(`${base}Motor`), type: 'motor', port: mechPorts[mp++] ?? 0, subsystemId: s.id, motorType: ms[0].type, cartridge: ms[0].type === '11W' ? ms[0].cartridge ?? 'green' : undefined, role: s.type });
    } else if (ms.length > 1) {
      ms.forEach((m, i) => {
        const suffix = i === 0 ? 'Left' : i === 1 ? 'Right' : `${i + 1}`;
        devices.push({ name: uniq(`${base}${suffix}Motor`), type: 'motor', port: mechPorts[mp++] ?? 0, subsystemId: s.id, motorType: m.type, cartridge: m.type === '11W' ? m.cartridge ?? 'green' : undefined, reversed: i === 1, group: base, role: s.type });
      });
    }
    if (isPneumatic(s)) threeWire.push({ name: uniq(`${base}Piston`), type: 'piston', port: '', subsystemId: s.id, role: s.type });
    if (s.type === 'tracking-wheels') {
      for (let i = 0; i < s.count; i++) devices.push({ name: uniq(`trackingRotation${i + 1}`), type: 'rotation', port: 0, subsystemId: s.id });
    }
  }
  for (const sn of spec.sensors) {
    const at = sn.attachTo && sn.attachTo !== 'chassis' && sn.attachTo !== 'drivetrain' ? camel(spec.subsystems.find((s) => s.id === sn.attachTo)?.name ?? sn.attachTo) : '';
    switch (sn.type) {
      case 'inertial': devices.push({ name: uniq('inertialSensor'), type: 'inertial', port: 20, subsystemId: sn.id }); break;
      case 'rotation': devices.push({ name: uniq(`${at || 'drive'}Rotation`), type: 'rotation', port: 0, subsystemId: sn.id }); break;
      case 'optical': devices.push({ name: uniq(`${at || 'front'}Optical`), type: 'optical', port: 0, subsystemId: sn.id }); break;
      case 'distance': devices.push({ name: uniq(`${sn.mount === 'rear' ? 'rear' : at || 'front'}Distance`), type: 'distance', port: 0, subsystemId: sn.id }); break;
      case 'gps': devices.push({ name: uniq('gpsSensor'), type: 'gps', port: 0, subsystemId: sn.id }); break;
      case 'ai-vision': devices.push({ name: uniq('aiVision'), type: 'ai-vision', port: 0, subsystemId: sn.id }); break;
      case 'bumper': threeWire.push({ name: uniq(`${at || sn.mount || 'rear'}Bumper`), type: 'bumper', port: '', subsystemId: sn.id }); break;
      case 'limit': threeWire.push({ name: uniq(`${at || sn.mount || 'arm'}Limit`), type: 'limit', port: '', subsystemId: sn.id }); break;
    }
  }
  devices.push({ name: 'radio', type: 'radio', port: 21, subsystemId: 'electronics' });

  const report: PortReport[] = [];
  const prev = new Map((previous ?? []).map((d) => [d.name, d.port]));
  const overrides = spec.portOverrides ?? {};
  const taken = new Map<string, string>();
  const key = (p: number | string) => String(p);
  // 1) overrides, 2) previous ports, 3) defaults, 4) next free
  const all = [...devices, ...threeWire];
  for (const d of all) {
    if (overrides[d.name] != null) { d.port = typeof overrides[d.name] === 'string' && /^\d+$/.test(String(overrides[d.name])) ? Number(overrides[d.name]) : overrides[d.name]; continue; }
    if (prev.has(d.name)) d.port = prev.get(d.name)!;
  }
  // three-wire defaults: solenoids first, then switches
  const letters = 'ABCDEFGH'.split('');
  for (const d of [...threeWire.filter((t) => t.type === 'piston'), ...threeWire.filter((t) => t.type !== 'piston')]) {
    if (typeof d.port === 'string' && letters.includes(d.port) && !taken.has(d.port)) { taken.set(d.port, d.name); continue; }
    const free = letters.find((l) => !taken.has(l));
    if (free) { if (d.port) report.push({ device: d.name, from: d.port, to: free, reason: 'duplicate three-wire port' }); d.port = free; taken.set(free, d.name); }
    else d.port = '?';
  }
  // smart ports: honour fixed ones in order, then fill
  const smartDevices = devices;
  for (const d of smartDevices) {
    const p = typeof d.port === 'number' ? d.port : Number(d.port);
    if (p >= 1 && p <= 21 && !taken.has(key(p))) { d.port = p; taken.set(key(p), d.name); }
    else { if (p >= 1 && p <= 21) report.push({ device: d.name, from: p, to: 0, reason: `port ${p} already used by ${taken.get(key(p))}` }); d.port = 0; }
  }
  for (const d of smartDevices) {
    if (d.port === 0) {
      let p = 1;
      while (taken.has(key(p)) && p <= 21) p++;
      if (p <= 21) { d.port = p; taken.set(key(p), d.name); const r = report.find((x) => x.device === d.name); if (r) r.to = p; }
      else d.port = 'none';
    }
  }
  return { devices: [...smartDevices, ...threeWire], report };
}

export const smartCount = (devices: Device[]) => devices.filter((d) => typeof d.port === 'number' || d.port === 'none').length;
export const threeWireCount = (devices: Device[]) => devices.filter((d) => d.type === 'piston' || d.type === 'bumper' || d.type === 'limit').length;
