import type { RobotSpec } from './spec';
import { subsystemMotors } from './spec';
import type { Metrics } from './metrics';
import type { Collision } from './generator';
import type { Device } from './ports';
import { smartCount, threeWireCount } from './ports';
import type { SeasonRules } from './seasons';

export type Severity = 'error' | 'warning' | 'info';
export interface RuleCheck { id: string; severity: Severity; pass: boolean; title: string; detail: string; ruleRef?: string; fixHint?: string }
export type Legality = 'practice' | 'decoration' | 'license_plate' | 'vexu_vai_only';

const verifySuffix = (verified: boolean) => (verified ? '' : ' (verify in the current Game Manual)');

export function runRules(args: {
  spec: RobotSpec; metrics: Metrics; season: SeasonRules; collisions: Collision[]; devices: Device[];
  printedParts?: { name: string; legality: Legality }[];
}): RuleCheck[] {
  const { spec, metrics: m, season, collisions, devices } = args;
  const r = season.rules;
  const out: RuleCheck[] = [];
  const program = spec.meta.program;

  // size.start
  const lim = r.startSizeIn.value;
  const dims: [string, number, number][] = [['length', m.startSize.length, lim[0]], ['width', m.startSize.width, lim[1]], ['height', m.startSize.height, lim[2]]];
  const over = dims.filter(([, v, l]) => v > l + 1e-9);
  const tight = dims.filter(([, v, l]) => v <= l && v > l - 0.25);
  const sizeText = `${m.startSize.length.toFixed(1)} × ${m.startSize.width.toFixed(1)} × ${m.startSize.height.toFixed(1)} in (limit ${lim.join(' × ')} in)`;
  if (over.length) out.push({ id: 'size.start', severity: 'error', pass: false, title: `Too big to start: ${over.map(([n, v, l]) => `${n} ${v.toFixed(1)} > ${l}`).join(', ')}`, detail: `Start size ${sizeText}. Planned subsystems do not count toward start size.${verifySuffix(r.startSizeIn.verified)}`, ruleRef: r.startSizeIn.ruleRef, fixHint: 'Shorten the frame, tuck the mechanism in its start pose, or reduce intake protrusion.' });
  else if (tight.length) out.push({ id: 'size.start', severity: 'warning', pass: true, title: `Fits the ${lim[0]}″ box — tight on ${tight.map(([n]) => n).join(', ')}`, detail: `Start size ${sizeText}. Sizing boxes are strict — leave about 0.25″ of margin.${verifySuffix(r.startSizeIn.verified)}`, ruleRef: r.startSizeIn.ruleRef });
  else out.push({ id: 'size.start', severity: 'error', pass: true, title: `Fits the ${lim[0]}″ sizing box`, detail: `Start size ${sizeText}.${verifySuffix(r.startSizeIn.verified)}`, ruleRef: r.startSizeIn.ruleRef });

  // power.motors
  const maxW = r.maxMotorPowerW.value;
  out.push({
    id: 'power.motors', severity: 'error', pass: m.motorPowerW <= maxW + 1e-9,
    title: m.motorPowerW <= maxW ? `${m.motorPowerW} W of ${maxW} W motor power` : `${m.motorPowerW} W is over the ${maxW} W motor limit`,
    detail: `${m.motors11W} × 11 W + ${m.motors55W} × 5.5 W, counting planned subsystems.${verifySuffix(r.maxMotorPowerW.verified)}`,
    fixHint: m.motorPowerW > maxW ? 'Move a mechanism to a 5.5 W motor or pneumatics, or use fewer drive motors.' : undefined,
  });

  // motors.cartridge
  const allSets = [spec.drivetrain.motors, ...(spec.drivetrain.hWheel ? [spec.drivetrain.hWheel.motors] : []), ...spec.subsystems.flatMap(subsystemMotors)];
  const badCart = allSets.filter((ms) => (ms.type === '11W' && !ms.cartridge) || (ms.type === '5.5W' && ms.cartridge));
  out.push({ id: 'motors.cartridge', severity: 'error', pass: badCart.length === 0, title: badCart.length ? 'Motor cartridge mismatch' : 'Motor cartridges OK', detail: badCart.length ? '11 W motors need a cartridge; 5.5 W motors have none.' : 'Every 11 W motor has a cartridge; 5.5 W motors have none.' });

  // electronics.core
  out.push({ id: 'electronics.core', severity: 'error', pass: true, title: '1 Brain, 1 battery, 1 radio', detail: `The generator places exactly one of each.${verifySuffix(r.brainCount.verified && r.batteryCount.verified)}` });

  // ports
  const sc = smartCount(devices), tw = threeWireCount(devices);
  out.push({ id: 'ports.smart', severity: 'error', pass: sc <= r.smartPorts.value, title: `${sc} of ${r.smartPorts.value} smart ports`, detail: 'Motors, smart sensors and the radio each use one smart port.' });
  out.push({ id: 'ports.threeWire', severity: 'error', pass: tw <= r.threeWirePorts.value, title: `${tw} of ${r.threeWirePorts.value} three-wire ports`, detail: 'Solenoids, bumpers and limit switches use three-wire ports A–H.' });

  // pneumatics.tanks
  const tanks = spec.electronics.pneumatics.airTanks;
  const tankPass = tanks <= r.maxAirTanks.value;
  out.push({ id: 'pneumatics.tanks', severity: tankPass || r.maxAirTanks.verified ? 'error' : 'warning', pass: tankPass, title: `${tanks} of ${r.maxAirTanks.value} air tanks`, detail: `Max ${r.maxPsi.value} psi.${verifySuffix(r.maxAirTanks.verified)}` });

  // printed.legality
  const printed = args.printedParts ?? [];
  if (program === 'V5RC') {
    const illegal = printed.filter((p) => p.legality !== 'decoration' && p.legality !== 'license_plate');
    out.push({ id: 'printed.legality', severity: 'warning', pass: illegal.length === 0, title: illegal.length ? `${illegal.length} printed part${illegal.length > 1 ? 's' : ''} not V5RC-legal` : 'No functional printed parts', detail: illegal.length ? `${illegal.map((p) => p.name).join(', ')}: not legal on a V5RC competition robot; fine for practice / VEX U / VEX AI.${verifySuffix(r.printedFunctionalPartsLegal.verified)}` : 'In V5RC, 3D-printed parts may only be non-functional decorations or license plates.' });
  }

  // drive.speed
  const sp = m.topSpeedInPerS;
  out.push({ id: 'drive.speed', severity: 'warning', pass: sp >= 30 && sp <= 100, title: sp < 30 ? `Slow drive (${sp.toFixed(1)} in/s)` : sp > 100 ? `Very fast drive (${sp.toFixed(1)} in/s)` : `Top speed ${sp.toFixed(1)} in/s (${m.topSpeedFtPerS.toFixed(2)} ft/s)`, detail: sp < 30 ? 'Under 30 in/s feels slow in matches.' : sp > 100 ? 'Over 100 in/s is hard to control and motors may overheat.' : `${m.wheelRpm} rpm at the wheel.` });

  // geometry.collisions
  out.push({ id: 'geometry.collisions', severity: 'error', pass: collisions.length === 0, title: collisions.length ? `${collisions.length} part collision${collisions.length > 1 ? 's' : ''}` : 'No part collisions', detail: collisions.length ? collisions.map((c) => c.message).join('; ') : 'Wheels, frame, mechanisms and electronics have room.' , fixHint: collisions.length ? 'Change track width, wheel size, or mechanism placement.' : undefined });

  // sensors.inertial
  const hasImu = spec.sensors.some((s) => s.type === 'inertial');
  out.push({ id: 'sensors.inertial', severity: 'info', pass: hasImu, title: hasImu ? 'Inertial sensor for accurate turns' : 'No inertial sensor', detail: hasImu ? 'Used by the smartdrive for turnFor / turnToHeading.' : 'Add one for accurate autonomous turns.' });

  // lift.torque
  for (const s of spec.subsystems) {
    if (s.type !== 'lift') continue;
    const red = s.motors.some((mm) => mm.type === '11W' && mm.cartridge === 'red');
    const reduction = s.gearing ? s.gearing.driven / s.gearing.driving : 1;
    const weak = s.armLengthIn > 10 && ((reduction < 3 && !red) || s.rubberBands === 0);
    out.push({ id: 'lift.torque', severity: 'warning', pass: !weak, title: weak ? `${s.name} may be underpowered` : `${s.name} torque looks OK`, detail: `${s.armLengthIn}″ arm, ${reduction.toFixed(1)}:1 reduction, ${s.rubberBands} rubber bands${red ? ', red cartridge' : ''}.`, fixHint: weak ? 'Use a 12:60 or 12:84 reduction, a red cartridge, and rubber bands.' : undefined });
  }

  // radio.clearance
  out.push({ id: 'radio.clearance', severity: 'warning', pass: spec.electronics.radioMount === 'top' || spec.electronics.radioMount === 'rear', title: 'Radio mounted high and in the open', detail: 'Keep it out of metal enclosures.' });

  // weight.high
  out.push({ id: 'weight.high', severity: 'info', pass: m.weightLb <= 16, title: `Estimated weight ${m.weightLb.toFixed(1)} lb`, detail: m.weightLb > 16 ? 'Over 16 lb — heavy robots are slower and harder on motors.' : 'Estimate from catalog weights and metal formulas.' });

  return out;
}

export const failingErrors = (checks: RuleCheck[]) => checks.filter((c) => c.severity === 'error' && !c.pass);
