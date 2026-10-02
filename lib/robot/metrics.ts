import { CATALOG, MOTOR_RPM, metalWeightLb } from './catalog';
import type { Gearing, MotorSet, RobotSpec } from './spec';
import { subsystemMotors } from './spec';
import type { GenResult, PartInstance } from './generator';
import { generate, isHardware } from './generator';

export function motorRpm(m: Pick<MotorSet, 'type' | 'cartridge'>): number {
  if (m.type === '5.5W') return 200;
  return MOTOR_RPM[m.cartridge ?? 'green'];
}
export function externalRatio(g: Gearing | null | undefined): number {
  return g ? g.driving / g.driven : 1;
}
export function topSpeedInPerS(wheelRpm: number, diameterIn: number): number {
  return (wheelRpm * Math.PI * diameterIn) / 60;
}
export function stallTorqueNm(m: Pick<MotorSet, 'type' | 'cartridge'>): number {
  if (m.type === '5.5W') return 0.5;
  return 2.1 * (100 / motorRpm(m));
}
export function pushLbf(motors: MotorSet, gearing: Gearing | null | undefined, diameterIn: number): number {
  const total = motors.count * (stallTorqueNm(motors) / externalRatio(gearing));
  return (total / ((diameterIn / 2) * 0.0254)) * 0.2248;
}
export function allMotorSets(spec: RobotSpec): MotorSet[] {
  const sets: MotorSet[] = [spec.drivetrain.motors];
  if (spec.drivetrain.type === 'hdrive' && spec.drivetrain.hWheel) sets.push(spec.drivetrain.hWheel.motors);
  for (const s of spec.subsystems) sets.push(...subsystemMotors(s));
  return sets;
}
export function motorPowerW(sets: MotorSet[]): number {
  return sets.reduce((s, m) => s + (m.type === '11W' ? 11 : 5.5) * m.count, 0);
}
export function gearCenterIn(a: number, b: number) { return (a + b) / 48; }
export function wheelTravelMm(d: number) { return Math.PI * d * 25.4; }

const WHEEL_WEIGHT: Record<string, number> = {
  'omni-2': 0.12, 'omni-2.75': 0.19, 'omni-3.25': 0.23, 'omni-4': 0.35,
  'traction-2': 0.1, 'traction-2.75': 0.17, 'traction-3.25': 0.21, 'traction-4': 0.3,
  'mecanum-2': 0.15, 'mecanum-4': 0.45,
}; // ≈ verified:false

export function partWeightLb(p: PartInstance): number {
  const cat = CATALOG[p.partId];
  const pr = p.params ?? {};
  const n = (k: string, d = 0) => (typeof pr[k] === 'number' ? (pr[k] as number) : d);
  if (!cat) return 0;
  switch (cat.render) {
    case 'channel': return metalWeightLb(p.partId, n('holes', 2) * 0.5);
    case 'angle': return metalWeightLb(p.partId, n('holes', 2) * 0.5);
    case 'plate': {
      if (p.partId === 'poly-plate') return n('w', 1) * n('l', 1) * Math.min(n('t', 0.06), 0.06) * 0.043;
      return n('w', 1) * n('l', 1) * Math.min(n('t', 0.064), 0.064) * 0.0975 * 0.87;
    }
    case 'wheel': return WHEEL_WEIGHT[`${pr.kind ?? 'omni'}-${n('d', 4)}`] ?? 0.25;
    case 'gear': return 0.005 + (n('teeth', 12) / 84) * 0.08;
    case 'sprocket': return 0.01;
    case 'roller': return n('len', 10) * 0.02;
    case 'shaft': return n('len', 2) * (p.partId === 'shaft-hs' ? 0.0178 : 0.0044);
    case 'chain': return n('len', 1) * 0.012;
    case 'cylinder': return p.partId === 'air-tank' ? 0.2 : 0.08;
    case 'standoff': return 0.004 * n('len', 1);
    default: return cat.weightLb ?? 0.02;
  }
}

export interface Metrics {
  motorRpm: number;
  externalRatio: number;
  wheelRpm: number;
  topSpeedInPerS: number;
  topSpeedFtPerS: number;
  pushLbf: number;
  motorPowerW: number;
  motors11W: number;
  motors55W: number;
  startSize: { length: number; width: number; height: number };
  maxHeight: number;
  weightLb: number;
  wheelTravelMm: number;
  wheelTravelPerMotorRevMm: number;
  groundClearanceIn: number;
  trackWidthIn: number;
  wheelBaseIn: number;
  wheelDiameterIn: number;
  liftPivotHeightIn?: number;
  armLengthIn?: number;
  partCount: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function computeMetrics(spec: RobotSpec, start: GenResult, max?: GenResult): Metrics {
  const dt = spec.drivetrain;
  const rpm = motorRpm(dt.motors);
  const ratio = externalRatio(dt.gearing);
  const wheelRpm = rpm * ratio;
  const speed = topSpeedInPerS(wheelRpm, dt.wheel.diameterIn);
  const sets = allMotorSets(spec);
  const solid = start.parts.filter((p) => !p.ghost);
  const smart = solid.filter((p) => CATALOG[p.partId]?.smartDevice).length;
  const screws = solid.filter((p) => p.partId === 'screw-8-32').length;
  const nuts = solid.filter((p) => p.partId === 'nut-nylock').length;
  let weight = 0;
  for (const p of solid) if (p.partId !== 'screw-8-32' && p.partId !== 'nut-nylock') weight += partWeightLb(p);
  weight += screws * 0.0042 + nuts * 0.0024 + 0.012 * smart;
  const b = start.bbox;
  const maxRes = max ?? generate(spec, { pose: 1 });
  // ground clearance = lowest chassis structure (rail web bottom or the battery plate)
  const clearance = Math.min(start.frame.webBottom, Math.max(0.75, start.frame.webBottom) - 0.07);
  const lift = spec.subsystems.find((s) => s.type === 'lift');
  return {
    motorRpm: rpm,
    externalRatio: r4(ratio),
    wheelRpm: r1(wheelRpm),
    topSpeedInPerS: r2(speed),
    topSpeedFtPerS: r2(speed / 12),
    pushLbf: r2(pushLbf(dt.motors, dt.gearing, dt.wheel.diameterIn)),
    motorPowerW: motorPowerW(sets),
    motors11W: sets.filter((m) => m.type === '11W').reduce((s, m) => s + m.count, 0),
    motors55W: sets.filter((m) => m.type === '5.5W').reduce((s, m) => s + m.count, 0),
    startSize: { length: r1(b.max[2] - b.min[2]), width: r1(b.max[0] - b.min[0]), height: r1(b.max[1] - b.min[1]) },
    maxHeight: r1(maxRes.bbox.max[1] - Math.min(0, maxRes.bbox.min[1])),
    weightLb: r1(weight),
    wheelTravelMm: r2(wheelTravelMm(dt.wheel.diameterIn)),
    wheelTravelPerMotorRevMm: r2(wheelTravelMm(dt.wheel.diameterIn) * ratio),
    groundClearanceIn: r2(clearance),
    trackWidthIn: dt.trackWidthIn,
    wheelBaseIn: dt.wheelBaseIn,
    wheelDiameterIn: dt.wheel.diameterIn,
    liftPivotHeightIn: lift && lift.type === 'lift' ? r2(lift.towerHeightIn - 0.75) : undefined,
    armLengthIn: lift && lift.type === 'lift' ? lift.armLengthIn : undefined,
    partCount: solid.filter((p) => !isHardware(p)).length,
  };
}

function r4(n: number) { return Math.round(n * 1e4) / 1e4; }
