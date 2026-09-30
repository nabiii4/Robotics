import { basisToEuler, v, type Vec3 } from '../math';
import type { Frame, Gen } from './core';
import { STEP } from './core';

export function buildElectronics(g: Gen, f: Frame) {
  const e = g.spec.electronics;
  const sub = 'electronics';
  // battery
  const batBottom = Math.max(f.webBottom, 0.75);
  let batPos: Vec3 = [0, batBottom + 0.59, -0.5];
  let batRot: Vec3 = [0, 0, 0];
  if (e.batteryMount === 'rear-low') batPos = [0, batBottom + 0.59, f.zR + 4];
  if (e.batteryMount === 'side-low') { batPos = [-(f.innerX - 1.3), batBottom + 0.59, 0]; }
  g.plate(sub, 'battery-plate', 'plate-5xN-al', [batPos[0], batBottom - 0.035, batPos[2]], [0, 0, 0], 2.5, 7.5, { step: STEP.electronics, label: 'Battery plate' });
  g.add(sub, 'battery', 'battery', batPos, batRot, { step: STEP.electronics, label: 'V5 Battery' });
  f.anchors.battery = batPos;

  // brain
  const standoff = 1.5;
  let brainPos: Vec3;
  let brainRot: Vec3 = [0, 0, 0];
  let standoffs = true;
  switch (e.brainMount) {
    case 'center-top':
      brainPos = [0, f.crossTop + standoff + 0.65 + 1.3, 0];
      break;
    case 'rear-vertical':
      brainPos = [0, f.crossTop + 2.75, f.zR + 0.2];
      brainRot = basisToEuler([1, 0, 0], [0, 0, -1], [0, 1, 0]);
      standoffs = false;
      break;
    case 'side-left':
    case 'side-right': {
      const sx = e.brainMount === 'side-right' ? 1 : -1;
      brainPos = [sx * (f.innerX - 0.7), f.crossTop + 2.75, -1];
      brainRot = basisToEuler([0, 1, 0], [-sx, 0, 0], [0, 0, 1]);
      standoffs = false;
      break;
    }
    default:
      brainPos = [0, f.crossTop + standoff + 0.65, f.zR + 0.5 + 2.75];
  }
  g.add(sub, 'brain', 'brain', brainPos, brainRot, { step: STEP.electronics, label: 'V5 Brain' });
  if (standoffs) {
    const bottom = brainPos[1] - 0.65;
    const len = Math.max(0.5, bottom - f.crossTop);
    for (const x of [-1.75, 1.75]) for (const dz of [-2.4, 2.4]) {
      g.add(sub, 'standoff', 'standoff', [x, f.crossTop + len / 2, brainPos[2] + dz], [0, 0, 0], { params: { len: Math.round(len * 4) / 4 }, step: STEP.electronics });
    }
  }
  f.anchors.brain = brainPos;

  // radio: high and unobstructed
  let radioPos: Vec3;
  if (e.radioMount === 'top' && f.radioSpot) radioPos = v.add(f.radioSpot, [0, 0.4, 0]);
  else if (e.radioMount === 'rear') radioPos = [2.8, f.crossTop + 1.2, f.zR - 0.15];
  else radioPos = e.brainMount === 'rear-top' || e.brainMount === 'center-top' ? v.add(brainPos, [2.6, 0.8, 0]) : [2.2, f.crossTop + 0.4, f.zR + 2];
  const radioRot: Vec3 = e.radioMount === 'rear' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  g.add(sub, 'radio', 'radio', radioPos, radioRot, { step: STEP.electronics, label: 'V5 Radio' });

  // pneumatics
  for (let i = 0; i < e.pneumatics.airTanks; i++) {
    g.add('pneumatics', 'tank', 'air-tank', [0, f.crossTop + 0.8, 1.6 + i * 1.7], [0, Math.PI / 2, 0], { params: { d: 1.4, len: 5 }, step: 90, label: 'Air tank' });
  }
  for (let i = 0; i < e.pneumatics.solenoids; i++) {
    g.add('pneumatics', 'solenoid', 'solenoid', [-2.6, f.crossTop + 0.5, 2 - i * 1.2], [0, 0, 0], { step: 90, label: 'Solenoid' });
  }

  // decal plate
  const decal = g.spec.appearance.decal;
  if (decal?.text) {
    if (decal.on === 'front-plate') g.add(sub, 'decal', 'decal-plate', [0, f.crossTop + 0.7, f.zF - 0.95], [0, 0, 0], { params: { w: 3, h: 1.2, text: decal.text.slice(0, 6) }, step: STEP.electronics, label: 'Decal plate' });
    else g.add(sub, 'decal', 'decal-plate', v.add(brainPos, [0, 1.2, 2.2]), [0, 0, 0], { params: { w: 3, h: 1.2, text: decal.text.slice(0, 6) }, step: STEP.electronics, label: 'Decal plate' });
  }
}

export function buildSensors(g: Gen, f: Frame, step: number) {
  for (const s of g.spec.sensors) {
    const sub = s.id;
    const at = s.attachTo ?? 'chassis';
    const bat = f.anchors.battery ?? [0, 1, 0];
    let pos: Vec3;
    let rot: Vec3 = [0, 0, 0];
    switch (s.type) {
      case 'inertial': pos = [bat[0] - 2.2, bat[1] - 0.2, bat[2] + 1]; break;
      case 'rotation': pos = f.anchors[at] ?? [f.innerX - 0.6, f.axleY, 0]; break;
      case 'optical': pos = f.anchors[`${at}:exit`] ?? v.add(f.anchors[at] ?? [0, f.crossTop, f.zF], [0, 0.5, 0]); break;
      case 'distance': {
        const rear = s.mount === 'rear';
        pos = [1.5, f.crossTop + 0.5, rear ? f.zR - 0.4 : f.zF - 0.3];
        break;
      }
      case 'gps': {
        const sx = s.mount === 'right' ? 1 : -1;
        pos = [sx * (f.sideX + 0.1), f.crossTop + 2.5, 0];
        rot = [0, 0, sx * Math.PI / 2];
        break;
      }
      case 'ai-vision': pos = f.radioSpot ? v.add(f.radioSpot, [2.2, 0.9, 0.6]) : [0, f.crossTop + 1.2, f.zF - 1]; break;
      default: pos = [-1.5, f.crossTop + 0.3, s.mount === 'front' ? f.zF - 0.5 : f.zR + 0.5];
    }
    g.add(sub, 'sensor', s.type, pos, rot, { step, label: s.type === 'inertial' ? 'Inertial sensor' : `${s.type} sensor` });
  }
}
