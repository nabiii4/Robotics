import { GEAR_TEETH, RobotSpecSchema, type Gearing, type GearTeeth, type MotorSet, type RobotSpec, type Subsystem } from './spec';
import { clamp, snap } from './math';
import { WHEEL_WIDTH } from './catalog';
import { z } from 'zod';

export interface NormalizeNote { path: string; from: unknown; to: unknown; reason: string }
export interface NormalizeResult { spec: RobotSpec; report: NormalizeNote[] }

const nearest = <T extends number>(val: number, opts: readonly T[]): T => opts.reduce((a, b) => (Math.abs(b - val) < Math.abs(a - val) ? b : a), opts[0]);

export function slugId(name: string, taken: Set<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'sub';
  let id = base, k = 2;
  while (taken.has(id)) id = `${base}-${k++}`;
  taken.add(id);
  return id;
}

export class SpecValidationError extends Error {
  constructor(public issues: z.ZodIssue[]) {
    super(issues.slice(0, 6).map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  }
}

/** Validate + normalize any RobotSpec (AI, user, template, import). Throws SpecValidationError when the shape is wrong. */
export function normalizeSpec(input: unknown, previous?: RobotSpec | null): NormalizeResult {
  const parsed = RobotSpecSchema.safeParse(input);
  if (!parsed.success) throw new SpecValidationError(parsed.error.issues);
  const raw = parsed.data;
  const report: NormalizeNote[] = [];
  const note = (path: string, from: unknown, to: unknown, reason: string) => { if (from !== to) report.push({ path, from, to, reason }); };

  const fixMotors = (path: string, m: z.infer<typeof RobotSpecSchema>['drivetrain']['motors']): MotorSet => {
    const out: MotorSet = { type: m.type, count: m.count };
    if (m.type === '11W') {
      out.cartridge = m.cartridge ?? 'green';
      if (!m.cartridge) note(`${path}.cartridge`, undefined, 'green', '11 W motors need a cartridge');
    } else if (m.cartridge) note(`${path}.cartridge`, m.cartridge, undefined, '5.5 W motors have no cartridge');
    return out;
  };
  const fixGearing = (path: string, g: { driving: number; driven: number } | null | undefined): Gearing | null => {
    if (!g) return null;
    const a = nearest(g.driving, GEAR_TEETH) as GearTeeth, b = nearest(g.driven, GEAR_TEETH) as GearTeeth;
    note(`${path}.driving`, g.driving, a, 'VEX gears come in 12–84 teeth');
    note(`${path}.driven`, g.driven, b, 'VEX gears come in 12–84 teeth');
    if (a === b) { note(path, `${a}:${b}`, null, 'equal gears = direct drive'); return null; }
    return { driving: a, driven: b };
  };
  const snapNote = (path: string, val: number, lo: number, hi: number, reason = 'snapped to the 0.5″ hole grid') => {
    const s = clamp(snap(val, 0.5), lo, hi);
    if (s !== val) note(path, val, s, val < lo || val > hi ? `clamped to ${lo}–${hi} in` : reason);
    return s;
  };

  // drivetrain
  const d = raw.drivetrain;
  let type = d.type;
  const motors = fixMotors('drivetrain.motors', d.motors);
  let wheelKind = d.wheel.kind;
  const wheelOpts = wheelKind === 'mecanum' ? ([2, 4] as const) : ([2.75, 3.25, 4] as const);
  let dia = nearest(d.wheel.diameterIn, wheelOpts) as 2 | 2.75 | 3.25 | 4;
  note('drivetrain.wheel.diameterIn', d.wheel.diameterIn, dia, `${wheelKind} wheels come in ${wheelOpts.join(', ')} in`);
  if (wheelKind === 'mecanum' && type !== 'mecanum') { note('drivetrain.type', type, 'mecanum', 'mecanum wheels need a mecanum drivetrain'); type = 'mecanum'; }
  if (type === 'mecanum' && wheelKind !== 'mecanum') { note('drivetrain.wheel.kind', wheelKind, 'mecanum', 'mecanum drivetrains use mecanum wheels'); wheelKind = 'mecanum'; dia = dia >= 3 ? 4 : 2; }
  if (type === 'xdrive' && wheelKind !== 'omni') { note('drivetrain.wheel.kind', wheelKind, 'omni', 'X-drive uses omni wheels'); wheelKind = 'omni'; if (dia === 2) dia = 2.75; }
  let count = Math.round(motors.count);
  if (count % 2 === 1) { note('drivetrain.motors.count', count, count + 1, 'drive motor count must be even'); count += 1; }
  if (count < 2) { note('drivetrain.motors.count', count, 2, 'at least 2 drive motors'); count = 2; }
  if (count > 8) { note('drivetrain.motors.count', count, 8, 'at most 8 drive motors'); count = 8; }
  if ((type === 'xdrive' || type === 'mecanum') && count !== 4 && count !== 8) { note('drivetrain.motors.count', count, 4, `${type} uses 4 (or 8) motors`); count = 4; }
  motors.count = count;
  let wps = Math.round(d.wheelsPerSide);
  if (type === 'mecanum' || type === 'xdrive') { if (wps !== 2) note('drivetrain.wheelsPerSide', wps, 2, `${type} uses 4 wheels`); wps = 2; }
  wps = clamp(wps, 2, 4);
  if (count / 2 > wps && type !== 'xdrive') { note('drivetrain.wheelsPerSide', wps, Math.min(4, count / 2), 'one wheel per drive motor'); wps = Math.min(4, count / 2); }
  let track = snapNote('drivetrain.trackWidthIn', d.trackWidthIn, 8, 17);
  let base = snapNote('drivetrain.wheelBaseIn', d.wheelBaseIn, 6, 16.5);
  if (type === 'xdrive' && base !== track) { note('drivetrain.wheelBaseIn', base, track, 'X-drive frames are square'); base = track; }
  const ww = WHEEL_WIDTH[`${wheelKind}-${dia}`] ?? 1;
  const mount = type === 'mecanum' || type === 'xdrive' ? 'outboard' : d.wheelMount;
  if (mount !== d.wheelMount) note('drivetrain.wheelMount', d.wheelMount, mount, `${type} wheels mount outboard`);
  // keep the frame inside 18 in for V5RC
  const program = raw.meta.program;
  const maxWidth = program === 'V5RC' ? 17.75 : 30;
  const width = mount === 'outboard' ? track + ww : track + ww + 1.4;
  if (width > maxWidth) { const t2 = snap(maxWidth - (width - track), 0.5); note('drivetrain.trackWidthIn', track, t2, 'keeps the frame inside the sizing box'); track = t2; }
  const lengthEst = base + dia + 0.5;
  if (program === 'V5RC' && lengthEst > 17.5) { const b2 = snap(17.5 - dia - 0.5, 0.5); note('drivetrain.wheelBaseIn', base, b2, 'keeps the frame inside the sizing box'); base = b2; }
  const cb = clamp(Math.round(d.crossbraces), 2, 4) as 2 | 3 | 4;
  let hWheel = undefined as RobotSpec['drivetrain']['hWheel'];
  if (type === 'hdrive') {
    const hw = d.hWheel ?? { diameterIn: 3.25, motors: { type: '11W', count: 1, cartridge: 'green' } };
    hWheel = { diameterIn: nearest(Number(hw.diameterIn), [2.75, 3.25, 4] as const), motors: fixMotors('drivetrain.hWheel.motors', { ...hw.motors, count: 1 }) };
    if (!d.hWheel) note('drivetrain.hWheel', undefined, 'added', 'H-drive needs a strafe wheel');
  }
  const drivetrain: RobotSpec['drivetrain'] = {
    type, motors, gearing: fixGearing('drivetrain.gearing', d.gearing), wheel: { kind: wheelKind, diameterIn: dia },
    wheelsPerSide: wps as 2 | 3 | 4, wheelMount: mount, trackWidthIn: track, wheelBaseIn: base, railChannel: d.railChannel, crossbraces: cb,
  };
  if (d.centerWheelsTraction && type === 'tank' && wps >= 3) drivetrain.centerWheelsTraction = true;
  if (hWheel) drivetrain.hWheel = hWheel;

  // subsystems + stable ids
  const taken = new Set<string>();
  const prevSubs = previous?.subsystems ?? [];
  const innerWidth = mount === 'outboard' ? track - ww - 1.2 : track - ww - 1.6;
  const subsystems: Subsystem[] = raw.subsystems.map((s0, i) => {
    let id = s0.id && !taken.has(s0.id) ? s0.id : undefined;
    if (!id) {
      const match = prevSubs.find((p) => p.type === s0.type && p.name.toLowerCase() === s0.name.toLowerCase() && !taken.has(p.id));
      id = match ? match.id : slugId(s0.name, taken);
      if (match && s0.id && s0.id !== match.id) note(`subsystems[${i}].id`, s0.id, match.id, 'kept the previous id');
    }
    taken.add(id);
    const status = s0.status;
    const path = `subsystems[${i}]`;
    const mfix = (ms: z.infer<typeof RobotSpecSchema>['drivetrain']['motors'][] | null | undefined, p: string) => (ms ?? []).map((m, k) => fixMotors(`${p}.motors[${k}]`, m)).filter((m) => m.count > 0);
    switch (s0.type) {
      case 'intake': {
        const w = snapNote(`${path}.widthIn`, s0.widthIn, 4, Math.max(4, snap(innerWidth, 0.5)));
        const rc = clamp(Math.round(s0.rollerCount), 1, 6);
        note(`${path}.rollerCount`, s0.rollerCount, rc, 'rollerCount is 1–6');
        const rd = nearest(s0.rollerDiameterIn, [1.625, 2, 2.5, 3, 4] as const);
        note(`${path}.rollerDiameterIn`, s0.rollerDiameterIn, rd, 'flex wheels come in 1.625, 2, 2.5, 3, 4 in');
        const stages = s0.stages >= 2 ? 2 : 1;
        const out: Subsystem = { id, name: s0.name, status, type: 'intake', variant: s0.variant, position: s0.position, stages, widthIn: w, rollerCount: rc, rollerDiameterIn: rd, pivot: s0.pivot, motors: mfix(s0.motors, path) };
        if (stages === 2) out.liftHeightIn = clamp(snap(s0.liftHeightIn ?? 6, 0.5), 3, 12);
        return out;
      }
      case 'lift': {
        const th = snapNote(`${path}.towerHeightIn`, s0.towerHeightIn, 4, 17.5);
        const al = snapNote(`${path}.armLengthIn`, s0.armLengthIn, 4, 16);
        const out: Subsystem = { id, name: s0.name, status, type: 'lift', variant: s0.variant, towerHeightIn: th, armLengthIn: al, maxAngleDeg: clamp(s0.maxAngleDeg ?? 100, 20, 160), motors: mfix(s0.motors, path), gearing: fixGearing(`${path}.gearing`, s0.gearing), rubberBands: clamp(Math.round(s0.rubberBands), 0, 16) };
        if (s0.endEffector) out.endEffector = s0.endEffector;
        return out;
      }
      case 'clamp': {
        const out: Subsystem = { id, name: s0.name, status, type: 'clamp', variant: s0.variant, position: s0.position };
        if (s0.variant === 'pneumatic-clamp') out.cylinders = { strokeMm: nearest(s0.cylinders?.strokeMm ?? 50, [25, 50, 75] as const), count: (s0.cylinders?.count ?? 1) >= 2 ? 2 : 1 };
        else out.motors = mfix(s0.motors ?? [{ type: '5.5W', count: 1 }], path);
        return out;
      }
      case 'launcher': {
        const out: Subsystem = { id, name: s0.name, status, type: 'launcher', variant: s0.variant, motors: mfix(s0.motors, path), gearing: fixGearing(`${path}.gearing`, s0.gearing) };
        if (s0.variant === 'flywheel') out.flywheelDiameterIn = nearest(s0.flywheelDiameterIn ?? 4, [2, 2.5, 3, 4] as const);
        if (s0.rubberBands != null) out.rubberBands = clamp(Math.round(s0.rubberBands), 0, 16);
        return out;
      }
      case 'tracking-wheels':
        return { id, name: s0.name, status, type: 'tracking-wheels', count: clamp(Math.round(s0.count), 1, 3) as 1 | 2 | 3, diameterIn: s0.diameterIn >= 2.5 ? 2.75 : 2 };
      default: {
        const out: Subsystem = { id, name: s0.name, status, type: s0.type, actuation: s0.actuation, position: s0.position, lengthIn: snapNote(`${path}.lengthIn`, s0.lengthIn, 2, 16) };
        if (s0.actuation === 'pneumatic') out.cylinders = { strokeMm: nearest(s0.cylinders?.strokeMm ?? 50, [25, 50, 75] as const), count: (s0.cylinders?.count ?? 1) >= 2 ? 2 : 1 };
        else out.motors = mfix(s0.motors ?? [{ type: '5.5W', count: 1 }], path);
        return out;
      }
    }
  });

  // sensors
  const sTaken = new Set<string>(subsystems.map((s) => s.id));
  const prevSensors = previous?.sensors ?? [];
  const sensors = raw.sensors.map((s0) => {
    let id = s0.id && !sTaken.has(s0.id) ? s0.id : undefined;
    if (!id) {
      const m = prevSensors.find((p) => p.type === s0.type && (p.attachTo ?? '') === (s0.attachTo ?? '') && !sTaken.has(p.id));
      id = m ? m.id : slugId(`${s0.attachTo && s0.attachTo !== 'chassis' ? s0.attachTo + '-' : ''}${s0.type}`, sTaken);
    }
    sTaken.add(id);
    const out: RobotSpec['sensors'][number] = { id, type: s0.type };
    if (s0.attachTo) out.attachTo = s0.attachTo;
    if (s0.mount) out.mount = s0.mount;
    return out;
  });

  // pneumatics: make sure there is air + solenoids for pneumatic mechanisms
  const pn = raw.electronics.pneumatics;
  const needSol = subsystems.filter((s) => (s.type === 'clamp' && s.variant === 'pneumatic-clamp') || (s.type === 'intake' && s.pivot === 'pneumatic') || ((s.type === 'wing' || s.type === 'hood' || s.type === 'hang' || s.type === 'descore-arm') && s.actuation === 'pneumatic')).length;
  let tanks = clamp(Math.round(pn.airTanks), 0, 2) as 0 | 1 | 2;
  let sol = Math.max(0, Math.round(pn.solenoids));
  if (needSol > 0 && tanks === 0) { note('electronics.pneumatics.airTanks', 0, 1, 'pneumatic mechanisms need an air tank'); tanks = 1; }
  if (sol < needSol) { note('electronics.pneumatics.solenoids', sol, needSol, 'one solenoid per pneumatic mechanism'); sol = needSol; }

  const spec: RobotSpec = {
    schemaVersion: 1,
    meta: {
      name: raw.meta.name, program: raw.meta.program, season: raw.meta.season,
      ...(raw.meta.tagline ? { tagline: raw.meta.tagline } : {}),
      ...(raw.meta.drawingPrefix ? { drawingPrefix: raw.meta.drawingPrefix } : {}),
      ...(raw.meta.notes ? { notes: raw.meta.notes } : {}),
    },
    appearance: {
      metal: raw.appearance.metal, accentColor: raw.appearance.accentColor.toUpperCase(), rollerColor: raw.appearance.rollerColor,
      ...(raw.appearance.decal ? { decal: raw.appearance.decal } : {}),
    },
    drivetrain,
    subsystems,
    sensors,
    electronics: { brainMount: raw.electronics.brainMount, batteryMount: raw.electronics.batteryMount, radioMount: raw.electronics.radioMount, pneumatics: { airTanks: tanks, solenoids: sol } },
    customPartIds: raw.customPartIds,
    portOverrides: raw.portOverrides ?? {},
  };
  return { spec, report };
}
