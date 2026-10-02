import { CATALOG } from '../catalog';
import type { RobotSpec } from '../spec';
import { applyMat, eulerToMat, overlapDepth, transformBox, unionBox, v, type AABB, type Vec3 } from '../math';
import { Gen, localBox, isHardware, STEP, type AssemblyStep, type Collision, type Frame, type PartInstance } from './core';
import { buildDrivetrain } from './drivetrain';
import { buildAccessory, buildClamp, buildIntake, buildLauncher, buildLift, buildTracking } from './mechanisms';
import { buildElectronics, buildSensors } from './electronics';

export type { PartInstance, Collision, AssemblyStep, Frame } from './core';
export { localBox, isHardware } from './core';

export interface GenResult {
  parts: PartInstance[];
  collisions: Collision[];
  steps: AssemblyStep[];
  bbox: AABB;
  frame: Frame;
}

/** Deterministic: the same spec + pose always yields the same parts and uids. */
export function generate(spec: RobotSpec, opts: { pose?: number } = {}): GenResult {
  const g = new Gen(spec, Math.min(1, Math.max(0, opts.pose ?? 0)));
  const frame = buildDrivetrain(g);
  // lifts first so the radio can go on the tower
  const order = [...spec.subsystems].sort((a, b) => (a.type === 'lift' ? -1 : 0) - (b.type === 'lift' ? -1 : 0));
  const stepOf = new Map<string, number>();
  spec.subsystems.forEach((s, i) => stepOf.set(s.id, STEP.subsystemBase + i));
  for (const s of order) {
    const step = stepOf.get(s.id)!;
    switch (s.type) {
      case 'intake': buildIntake(g, s, frame, step); break;
      case 'lift': buildLift(g, s, frame, step); break;
      case 'clamp': buildClamp(g, s, frame, step); break;
      case 'launcher': buildLauncher(g, s, frame, step); break;
      case 'tracking-wheels': buildTracking(g, s, frame, step); break;
      default: buildAccessory(g, s, frame, step);
    }
  }
  buildElectronics(g, frame);
  const sensorStep = STEP.subsystemBase + spec.subsystems.length;
  buildSensors(g, frame, sensorStep);
  // renumber pneumatics step after sensors
  for (const p of g.parts) if (p.step === 90) p.step = sensorStep + 1;

  const boxes = g.parts.map((p) => transformBox(localBox(p), p.position, p.rotation));
  const solid = boxes.filter((_, i) => !g.parts[i].ghost);
  const bbox = unionBox(solid.length ? solid : boxes);
  const collisions = findCollisions(g.parts, boxes);
  const steps = buildSteps(spec, g.parts, frame, sensorStep);
  return { parts: g.parts, collisions, steps, bbox, frame };
}

const MOTION_ATTACHED = new Set(['shaft-hs', 'shaft-std', 'gear-hs', 'sprocket', 'chain', 'collar', 'omni-wheel', 'traction-wheel', 'mecanum-wheel']);
const ELECTRONICS = new Set(['brain', 'battery', 'radio']);

function findCollisions(parts: PartInstance[], boxes: AABB[]): Collision[] {
  const out: Collision[] = [];
  const seen = new Set<string>();
  const name = (p: PartInstance) => p.label ?? CATALOG[p.partId]?.name ?? p.partId;
  const push = (a: PartInstance, b: PartInstance, msg: string) => {
    const key = `${a.subsystemId}|${b.subsystemId}|${a.partId}|${b.partId}`;
    if (seen.has(key) || out.length >= 12) return;
    seen.add(key);
    out.push({ a: a.uid, b: b.uid, message: msg });
  };
  parts.forEach((a, i) => {
    if (a.ghost || isHardware(a)) return;
    const isWheel = CATALOG[a.partId]?.render === 'wheel';
    const isElec = ELECTRONICS.has(a.partId);
    if (!isWheel && !isElec) return;
    parts.forEach((b, j) => {
      if (i === j || b.ghost || isHardware(b) || b.partId === 'rubber-band') return;
      if (isWheel) {
        if (MOTION_ATTACHED.has(b.partId) && b.subsystemId === a.subsystemId) return;
        if (CATALOG[b.partId]?.render === 'wheel' && b.subsystemId === a.subsystemId) return;
        if (b.partId === 'rotation' && b.subsystemId === a.subsystemId) return;
        if (overlapDepth(boxes[i], boxes[j]) > 0.08 && overlapDepth(localBox(a), boxInFrame(b, a)) > 0.08) push(a, b, `${name(a)} collides with ${name(b)}`);
      } else if (isElec && b.subsystemId !== 'electronics' && b.subsystemId !== 'drivetrain' && !CATALOG[b.partId]?.hardware) {
        if (b.partId.startsWith('shaft') || b.partId === 'collar') return;
        if (overlapDepth(boxes[i], boxes[j]) > 0.08) push(b, a, `${name(b)} (${b.subsystemId}) hits the ${name(a)}`);
      }
    });
  });
  return out;
}

/** part b's box expressed in part a's local frame (tight for a) */
function boxInFrame(b: PartInstance, a: PartInstance): AABB {
  const mb = eulerToMat(b.rotation);
  const ma = eulerToMat(a.rotation);
  const lb = localBox(b);
  const min: Vec3 = [Infinity, Infinity, Infinity], max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let k = 0; k < 8; k++) {
    const c: Vec3 = [k & 1 ? lb.max[0] : lb.min[0], k & 2 ? lb.max[1] : lb.min[1], k & 4 ? lb.max[2] : lb.min[2]];
    const w = v.sub(v.add(applyMat(mb, c), b.position), a.position);
    // inverse rotation = transpose
    const l: Vec3 = [ma[0] * w[0] + ma[3] * w[1] + ma[6] * w[2], ma[1] * w[0] + ma[4] * w[1] + ma[7] * w[2], ma[2] * w[0] + ma[5] * w[1] + ma[8] * w[2]];
    for (let q = 0; q < 3; q++) { min[q] = Math.min(min[q], l[q]); max[q] = Math.max(max[q], l[q]); }
  }
  return { min, max };
}

function count(parts: PartInstance[], pred: (p: PartInstance) => boolean) { return parts.filter(pred).length; }

function buildSteps(spec: RobotSpec, parts: PartInstance[], frame: Frame, sensorStep: number): AssemblyStep[] {
  const dt = spec.drivetrain;
  const by = (step: number) => parts.filter((p) => p.step === step).map((p) => p.uid);
  const steps: AssemblyStep[] = [];
  const rails = count(parts, (p) => p.step === STEP.frame && p.uid.includes(':rail'));
  const cbs = count(parts, (p) => p.uid.startsWith('drivetrain:crossbrace:'));
  steps.push({
    index: STEP.frame, title: 'Rails & crossbraces', partUids: by(STEP.frame),
    instruction: `Cut ${rails} × ${dt.railChannel} C-channel rails to ${frame.L.toFixed(1)} in (${Math.round(frame.L / 0.5)} holes) and join them with ${cbs} crossbraces using 8-32 × 3/8″ screws and nylock nuts.`,
    checks: ['Frame is square — measure both diagonals', 'Rails are parallel and the same length'],
  });
  const wheels = count(parts, (p) => p.uid.startsWith('drivetrain:wheel:'));
  steps.push({
    index: STEP.wheels, title: 'Bearings, axles, wheels', partUids: by(STEP.wheels),
    instruction: `Mount ${wheels} × ${dt.wheel.diameterIn}″ ${dt.wheel.kind} wheels on 1/4″ HS shafts through bearing flats${dt.type === 'mecanum' ? ' — mecanum wheels go in an X pattern (front-left and back-right match)' : ''}. Add collars on both ends of every shaft.`,
    checks: ['Wheels spin freely', 'No side-to-side play on the shafts'],
  });
  const cart = dt.motors.type === '11W' ? ` (${dt.motors.cartridge ?? 'green'} ${({ red: 100, green: 200, blue: 600 } as const)[dt.motors.cartridge ?? 'green']} rpm)` : '';
  steps.push({
    index: STEP.driveMotors, title: 'Drive motors & gears/chain', partUids: by(STEP.driveMotors),
    instruction: `Attach ${dt.motors.count} × V5 Smart Motor (${dt.motors.type}${cart}) to the ${dt.wheelMount === 'outboard' ? '' : 'inner '}rails with 8-32 screws${dt.gearing ? `, meshing ${dt.gearing.driving}T pinions with ${dt.gearing.driven}T wheel gears` : ''}.`,
    checks: ['Each motor turns its wheel in the same direction when driven forward', 'Gears mesh without binding'],
    notes: frame.notes,
  });
  steps.push({
    index: STEP.electronics, title: 'Battery, brain & radio mounts', partUids: by(STEP.electronics),
    instruction: `Secure the battery low on its plate, mount the Brain (${spec.electronics.brainMount}) on standoffs, and place the radio high and away from metal.`,
    checks: ['Battery cannot slide', 'Brain screen is reachable', 'Radio is not enclosed by metal'],
  });
  spec.subsystems.forEach((s, i) => {
    const idx = STEP.subsystemBase + i;
    steps.push({
      index: idx, title: `${s.name} (${s.type})${s.status === 'planned' ? ' — planned' : ''}`, partUids: by(idx),
      instruction: subsystemInstruction(s),
      checks: s.type === 'lift' ? ['Arm moves through its full range without hitting electronics', 'Rubber bands hold the arm near the middle'] : ['Mechanism moves freely by hand'],
    });
  });
  if (spec.sensors.length) steps.push({ index: sensorStep, title: 'Sensors', partUids: by(sensorStep), instruction: `Mount ${spec.sensors.map((s) => s.type).join(', ')}. Keep the inertial sensor flat near the center of rotation.`, checks: ['Sensors are firmly mounted'] });
  if (spec.electronics.pneumatics.airTanks || spec.electronics.pneumatics.solenoids) steps.push({ index: sensorStep + 1, title: 'Pneumatics', partUids: by(sensorStep + 1), instruction: 'Mount tanks horizontally near the center, run tubing to the solenoids and cylinders.', checks: ['No leaks at 100 psi (check the season limit)'] });
  steps.push({ index: sensorStep + 2, title: 'Wiring', partUids: [], instruction: 'Plug every device into the port shown in the port map (VEX Code tab). Route cables away from moving parts and zip-tie them.', checks: ['Every device shows up on the Brain Devices screen'] });
  steps.push({ index: sensorStep + 3, title: 'Final checks', partUids: [], instruction: 'Fit the robot in the 18″ sizing box in its start pose and run each mechanism.', checks: ['Fits the sizing box', 'Nothing rubs or binds', 'Battery is charged'] });
  return steps;
}

function subsystemInstruction(s: RobotSpec['subsystems'][number]): string {
  switch (s.type) {
    case 'intake': return `Build two 1x2x1 side arms, then mount ${s.rollerCount} × ${s.rollerDiameterIn}″ flex-wheel rollers on HS shafts, ${s.stages === 2 ? 'with the second stage angled up toward the robot' : 'spaced about 1.75″ apart'}. Drive them with the ${s.motors.map((m) => m.type).join(' + ')} motor through a chain loop.`;
    case 'lift': return `Build the ${s.variant} tower to ${s.towerHeightIn}″, add the ${s.armLengthIn}″ arms on the pivot shaft${s.gearing ? `, and drive the ${s.gearing.driven}T gears from ${s.gearing.driving}T pinions` : ''}. Add ${s.rubberBands} rubber bands to balance the arm.`;
    case 'clamp': return s.variant === 'pneumatic-clamp' ? `Hinge the clamp plate at the ${s.position} and mount ${s.cylinders?.count ?? 1} × ${s.cylinders?.strokeMm ?? 50} mm cylinder(s) to close it.` : `Build two geared claw fingers at the ${s.position} driven by one motor.`;
    case 'launcher': return `Build the ${s.variant}${s.gearing ? ` with a ${s.gearing.driving}:${s.gearing.driven} reduction` : ''}.`;
    case 'tracking-wheels': return `Mount ${s.count} × ${s.diameterIn}″ tracking wheels on rotation sensors under the chassis, spring-loaded to the floor.`;
    default: return `Hinge the ${s.type} (${s.lengthIn}″) and actuate it with ${s.actuation}.`;
  }
}
