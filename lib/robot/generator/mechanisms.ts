import type { AccessorySub, ClampSub, IntakeSub, LauncherSub, LiftSub, MotorSet, TrackingSub } from '../spec';
import { basisToEuler, clamp, DEG, orient, r4, v, type Vec3 } from '../math';
import type { Frame, Gen } from './core';
import { motorSize } from './core';

const ROLLER_COLORS = { red: '#C8102E', black: '#1E1F21', gray: '#8A9097' } as const;

function motorPart(m?: MotorSet) {
  return m?.type === '5.5W' ? 'motor-5.5w' : 'motor-11w';
}
function motorParams(m?: MotorSet) {
  return m && m.type === '11W' ? { cartridge: m.cartridge ?? 'green' } : undefined;
}
/** motor with shaft along world ±X, body vertical */
function motorRotX(outward: number): Vec3 {
  const x: Vec3 = [Math.sign(outward) || 1, 0, 0];
  const y: Vec3 = [0, 1, 0];
  return basisToEuler(x, y, v.cross(x, y));
}
function flattenMotors(sets: MotorSet[] | undefined): MotorSet[] {
  const out: MotorSet[] = [];
  for (const m of sets ?? []) for (let i = 0; i < m.count; i++) out.push({ ...m, count: 1 });
  return out;
}

export function buildIntake(g: Gen, s: IntakeSub, f: Frame, step: number) {
  const ghost = s.status === 'planned';
  const sign = s.position === 'front' ? 1 : -1;
  const rr = s.rollerDiameterIn / 2;
  const W = s.widthIn;
  const n = Math.max(1, Math.round(s.rollerCount));
  const theta = (s.stages === 2 ? 55 : 30) * DEG;
  const edge = sign > 0 ? f.zF : f.zR;
  const P0: Vec3 = [0, rr + 0.3, edge + sign * (rr - 0.2)];
  const dir: Vec3 = [0, Math.sin(theta), -sign * Math.cos(theta)];
  const spacing = n <= 1 ? 0 : s.stages === 2
    ? clamp(((s.liftHeightIn ?? 6) - P0[1]) / ((n - 1) * Math.sin(theta)), 1.5, 2.2)
    : 1.75;
  const centers = Array.from({ length: n }, (_, k) => v.add(P0, v.mul(dir, spacing * k)));
  const last = centers[centers.length - 1];
  const armX = W / 2 + 0.3;
  const color = s.variant === 'flex-wheel-roller' ? ROLLER_COLORS[g.spec.appearance.rollerColor] : s.variant === 'chain-flaps' ? '#2B2E33' : '#8A9097';
  for (const sx of [1, -1]) {
    g.member(s.id, 'arm', g.channelId('1x2x1'), v.add(v.sub(P0, v.mul(dir, 0.75)), [sx * armX, 0, 0]), v.add(v.add(last, v.mul(dir, 0.75)), [sx * armX, 0, 0]), [sx, 0, 0], { step, ghost, label: 'Intake side arm' });
  }
  // mount the arms to the frame
  const mountZ = edge - sign * 0.75;
  for (const sx of [1, -1]) {
    const top: Vec3 = [sx * armX, f.crossTop - 0.25, mountZ];
    const armPt = v.add(centers[Math.min(1, n - 1)], [sx * armX, 0, 0]);
    if (v.len(v.sub(armPt, top)) > 1.2) g.member(s.id, 'mount', g.channelId('1x2x1'), top, armPt, [sx, 0, 0], { step, ghost, hardware: false, label: 'Intake mount' });
  }
  centers.forEach((c, k) => {
    g.add(s.id, 'roller', 'flex-wheel', c, [0, 0, 0], { params: { d: s.rollerDiameterIn, len: r4(W - 0.2), variant: s.variant }, step, ghost, color, label: `Roller ${k + 1}` });
    g.shaft(s.id, -armX - 0.3, armX + 0.6, c[1], c[2], { step, ghost, hs: false });
    if (n > 1) g.add(s.id, 'sprocket', 'sprocket', [armX + 0.35, c[1], c[2]], [0, 0, 0], { params: { teeth: 12, face: 0.12 }, step, ghost, color: '#2B2E33' });
  });
  for (let k = 0; k < n - 1; k++) {
    const a = centers[k], b = centers[k + 1];
    const mid = v.lerp(a, b, 0.5);
    const perp: Vec3 = [0, Math.cos(theta), sign * Math.sin(theta)];
    for (const off of [0.3, -0.3]) g.add(s.id, 'chain', 'chain', v.add(v.add(mid, v.mul(perp, off)), [armX + 0.35, 0, 0]), orient(v.sub(b, a), [0, 1, 0]), { params: { len: r4(spacing) }, step, ghost });
  }
  const motors = flattenMotors(s.motors);
  const ms = motorSize(motorPart(motors[0]));
  motors.forEach((m, i) => {
    const c = centers[Math.max(0, n - 1 - i)];
    const sx = i % 2 === 0 ? -1 : 1;
    g.add(s.id, 'motor', motorPart(m), [sx * (armX + 0.1 + ms[0] / 2), c[1], c[2]], motorRotX(sx), { params: motorParams(m), step, ghost, label: `${s.name} motor` });
  });
  if (s.pivot === 'pneumatic') {
    const base: Vec3 = [0, f.crossTop + 0.4, edge - sign * 4];
    g.add(s.id, 'cylinder', 'pneumatic-cylinder', v.lerp(base, centers[Math.min(1, n - 1)], 0.5), orient(v.sub(centers[Math.min(1, n - 1)], base), [0, 1, 0]), { params: { d: 0.6, len: r4(v.len(v.sub(centers[Math.min(1, n - 1)], base))), stroke: 50 }, step, ghost });
  }
  f.anchors[s.id] = last;
  f.anchors[`${s.id}:exit`] = v.add(last, [-(armX - 0.6), 0.6, 0]);
}

function startAngle(pivot: Vec3, L: number, f: Frame, ee: number, dirSign: number) {
  const limit = (dirSign > 0 ? f.zF : -f.zR) + 1.2;
  for (let a = -5; a >= -85; a -= 2.5) {
    const tipZ = dirSign * pivot[2] + L * Math.cos(a * DEG) + ee;
    const tipY = pivot[1] + L * Math.sin(a * DEG);
    if (tipZ <= limit && tipY >= 2.0) return a;
  }
  return -85;
}

export function buildLift(g: Gen, s: LiftSub, f: Frame, step: number) {
  const ghost = s.status === 'planned';
  const H = s.towerHeightIn;
  const L = s.armLengthIn;
  const tx = f.towerX;
  const towerZ = f.zR + 0.3 * f.L;
  const footR: Vec3 = [0, f.railTop, f.zR + 0.5];
  const footF: Vec3 = [0, f.railTop, Math.min(f.zF - 0.5, towerZ + (towerZ - footR[2]))];
  const pivotY = s.variant === 'dr4b' || s.variant === 'linear-slide' ? H - 0.75 : H - 0.75;
  const pivot: Vec3 = [0, pivotY, towerZ];
  const cid = g.channelId('1x2x1');
  for (const sx of [1, -1]) {
    const top: Vec3 = [sx * tx, H, towerZ];
    if (s.variant === 'linear-slide') {
      g.member(s.id, 'tower', cid, [sx * tx, f.railTop, towerZ], top, [-sx, 0, 0], { step, ghost, label: 'Slide tower' });
    } else {
      g.member(s.id, 'tower-leg', cid, [sx * tx, footR[1], footR[2]], top, [-sx, 0, 0], { step, ghost, label: 'Tower leg (rear)' });
      g.member(s.id, 'tower-leg', cid, [sx * tx, footF[1], footF[2]], top, [-sx, 0, 0], { step, ghost, label: 'Tower leg (front)' });
    }
  }
  g.member(s.id, 'tower-bar', cid, [-tx - 0.25, H - 1.75, towerZ], [tx + 0.25, H - 1.75, towerZ], [0, -1, 0], { step, ghost, label: 'Tower crossbar' });
  f.radioSpot = [0, H - 1.25, towerZ];

  const motors = flattenMotors(s.motors);
  const driven = s.gearing?.driven ?? 60;
  const driving = s.gearing?.driving ?? 12;
  const cd = s.gearing ? (driving + driven) / 48 : 0;
  const gearX = tx + 0.5;
  const armX = gearX + 0.55;
  const accent = g.spec.appearance.accentColor;

  const ee = s.endEffector === 'fork' ? 1.25 : s.endEffector === 'claw' ? 1.5 : s.endEffector === 'hook' ? 0.75 : 0;
  const maxA = s.maxAngleDeg ?? 100;

  if (s.variant === 'linear-slide') {
    const ext = g.pose * L;
    for (const sx of [1, -1]) {
      g.member(s.id, 'slide', cid, [sx * (tx - 0.55), f.railTop + 1 + ext, towerZ + 0.3], [sx * (tx - 0.55), H + ext, towerZ + 0.3], [-sx, 0, 0], { step, ghost, label: 'Slide stage' });
    }
    g.plate(s.id, 'carriage', 'plate-5xN-al', [0, H - 1 + ext, towerZ + 1.2], [Math.PI / 2, 0, 0], 2 * tx - 1, 2.5, { step, ghost, label: 'Carriage' });
    motors.forEach((m, i) => g.add(s.id, 'motor', motorPart(m), [(i % 2 ? -1 : 1) * (tx - 1.4), f.crossTop + 1.5, towerZ - 1], motorRotX(i % 2 ? -1 : 1), { params: motorParams(m), step, ghost, label: `${s.name} motor` }));
    f.anchors[s.id] = [tx - 0.6, f.railTop + 1.5, towerZ];
    return;
  }

  const a0 = startAngle(pivot, L, f, ee, 1);
  const a = (a0 + g.pose * maxA) * DEG;
  const dir: Vec3 = [0, Math.sin(a), Math.cos(a)];

  // gears + motors
  for (const sx of [1, -1]) {
    g.add(s.id, 'gear', 'gear-hs', [sx * gearX, pivotY, towerZ], [0, 0, 0], { params: { teeth: driven, face: 0.5 }, step, ghost, color: accent, label: `${driven}T lift gear` });
  }
  g.shaft(s.id, -armX - 0.45, armX + 0.45, pivotY, towerZ, { step, ghost });
  const ms = motorSize(motorPart(motors[0]));
  motors.forEach((m, i) => {
    const sx = i % 2 === 0 ? 1 : -1;
    const y = pivotY - cd - (i >= 2 ? 0 : 0);
    const z = towerZ + (i >= 2 ? -2.4 : 0);
    g.add(s.id, 'motor', motorPart(m), [sx * (tx - 0.3 - ms[0] / 2), y, z], motorRotX(sx), { params: motorParams(m), step, ghost, label: `${s.name} motor` });
    if (s.gearing) g.add(s.id, 'pinion', 'gear-hs', [sx * gearX, y, z], [0, 0, 0], { params: { teeth: driving, face: 0.5 }, step, ghost, color: accent });
  });

  const tipOf = (p: Vec3, d: Vec3, len: number) => v.add(p, v.mul(d, len));
  const arms: { from: Vec3; to: Vec3 }[] = [];
  if (s.variant === 'four-bar' || s.variant === 'six-bar') {
    const low: Vec3 = [0, pivotY - 2.5, towerZ];
    for (const sx of [1, -1]) {
      for (const p of [pivot, low]) {
        g.member(s.id, 'bar', cid, v.add(v.sub(p, v.mul(dir, 0.5)), [sx * armX, 0, 0]), v.add(tipOf(p, dir, L), [sx * armX, 0, 0]), [sx, 0, 0], { step, ghost, label: 'Four-bar link' });
      }
      const tipHi = tipOf(pivot, dir, L), tipLo = tipOf(low, dir, L);
      g.member(s.id, 'coupler', cid, v.add(v.add(tipLo, [0, -(s.variant === 'six-bar' ? 2 : 0.5), 0]), [sx * (armX + 0.55), 0, 0]), v.add(v.add(tipHi, [0, 0.5, 0]), [sx * (armX + 0.55), 0, 0]), [sx, 0, 0], { step, ghost, label: 'Coupler' });
    }
    arms.push({ from: pivot, to: tipOf(pivot, dir, L) });
  } else if (s.variant === 'dr4b') {
    const half = L / 2;
    const a1 = (-60 + g.pose * 95) * DEG;
    const d1: Vec3 = [0, Math.sin(a1), Math.cos(a1)];
    const d2: Vec3 = [0, -Math.sin(a1), Math.cos(a1)];
    for (const sx of [1, -1]) {
      const mid = tipOf(pivot, d1, half);
      g.member(s.id, 'bar', cid, v.add(pivot, [sx * armX, 0, 0]), v.add(mid, [sx * armX, 0, 0]), [sx, 0, 0], { step, ghost, label: 'DR4B stage 1' });
      g.member(s.id, 'bar', cid, v.add(v.add(pivot, [0, -2.5, 0]), [sx * armX, 0, 0]), v.add(v.add(mid, [0, -2.5, 0]), [sx * armX, 0, 0]), [sx, 0, 0], { step, ghost, label: 'DR4B stage 1' });
      g.member(s.id, 'bar', cid, v.add(mid, [sx * (armX + 0.55), 0, 0]), v.add(tipOf(mid, v.mul(d2, -1), half), [sx * (armX + 0.55), 0, 0]), [sx, 0, 0], { step, ghost, label: 'DR4B stage 2' });
    }
    const mid = tipOf(pivot, d1, half);
    arms.push({ from: mid, to: tipOf(mid, v.mul(d2, -1), half) });
  } else {
    for (const sx of [1, -1]) {
      g.member(s.id, 'arm', cid, v.add(v.sub(pivot, v.mul(dir, 0.75)), [sx * armX, 0, 0]), v.add(tipOf(pivot, dir, L), [sx * armX, 0, 0]), [sx, 0, 0], { step, ghost, label: 'Lift arm' });
    }
    arms.push({ from: pivot, to: tipOf(pivot, dir, L) });
    if (s.variant === 'chain-bar') {
      const tip = tipOf(pivot, dir, L);
      const d2: Vec3 = [0, Math.sin(a + (90 - 60 * g.pose) * DEG), Math.cos(a + (90 - 60 * g.pose) * DEG)];
      for (const sx of [1, -1]) g.member(s.id, 'bar', cid, v.add(tip, [sx * (armX + 0.55), 0, 0]), v.add(tipOf(tip, d2, 4), [sx * (armX + 0.55), 0, 0]), [sx, 0, 0], { step, ghost, label: 'Chain bar' });
    }
  }
  const arm = arms[0];
  const tip = arm.to;
  // crossbars between the arms
  g.member(s.id, 'arm-bar', cid, [-armX - 0.25, tip[1], tip[2]], [armX + 0.25, tip[1], tip[2]], v.mul(dir, -1), { step, ghost, label: 'Arm crossbar' });
  const midPt = v.lerp(arm.from, tip, 0.55);
  g.member(s.id, 'arm-bar', cid, [-armX - 0.25, midPt[1], midPt[2]], [armX + 0.25, midPt[1], midPt[2]], [0, 1, 0], { step, ghost, label: 'Arm crossbar' });

  // end effector: keep level relative to the start pose
  const lvl = (a0 * DEG) - a;
  const eeDir: Vec3 = [0, Math.sin(a + lvl), Math.cos(a + lvl)];
  if (s.endEffector === 'fork') {
    for (const x of [-2.75, 2.75]) g.plate(s.id, 'fork', 'flat-bar-1xN-al', v.add(v.add(tip, v.mul(eeDir, ee / 2)), [x, -0.3, 0]), orient(eeDir, [0, 1, 0]), 0.5, ee + 0.5, { step, ghost, label: 'Fork prong' });
  } else if (s.endEffector === 'claw') {
    for (const x of [-1.2, 1.2]) g.plate(s.id, 'claw', 'plate-5xN-al', v.add(v.add(tip, v.mul(eeDir, ee / 2)), [x, -0.8, 0]), orient(eeDir, [1, 0, 0]), 1.5, ee, { step, ghost, label: 'Claw finger' });
  } else if (s.endEffector === 'hook') {
    g.plate(s.id, 'hook', 'flat-bar-1xN-al', v.add(tip, [0, -0.6, 0.3]), [0, 0, 0], 0.5, 1.2, { step, ghost, label: 'Hook' });
  }

  // rubber bands from the tower top to the arm
  const bands = Math.max(0, Math.round(s.rubberBands));
  for (let i = 0; i < Math.min(bands, 6); i++) {
    const sx = i % 2 === 0 ? 1 : -1;
    const from: Vec3 = [sx * (tx + 0.1 + 0.08 * Math.floor(i / 2)), H + 0.2, towerZ - 1.2];
    const to = v.add(v.lerp(arm.from, tip, 0.3), [sx * (armX - 0.1 - 0.08 * Math.floor(i / 2)), 0, 0]);
    g.add(s.id, 'band', 'rubber-band', v.lerp(from, to, 0.5), orient(v.sub(to, from), [0, 1, 0]), { params: { len: r4(v.len(v.sub(to, from))) }, step, ghost, color: '#1E1F21' });
  }
  f.anchors[s.id] = [tx - 0.5, pivotY, towerZ];
  f.anchors[`${s.id}:tip`] = tip;
}

export function buildClamp(g: Gen, s: ClampSub, f: Frame, step: number) {
  const ghost = s.status === 'planned';
  const sign = s.position === 'front' ? 1 : -1;
  const edge = sign > 0 ? f.zF : f.zR;
  const hinge: Vec3 = [0, f.crossTop + 0.2, edge - sign * 0.5];
  if (s.variant === 'pneumatic-clamp') {
    const ang = (60 - g.pose * 55) * DEG;
    const d: Vec3 = [0, Math.sin(ang), sign * Math.cos(ang)];
    g.plate(s.id, 'clamp-plate', 'plate-5xN-al', v.add(hinge, v.mul(d, 1.5)), orient(d, [0, sign * -Math.cos(ang), Math.sin(ang)] as Vec3), 4.5, 3, { step, ghost, label: 'Clamp plate' });
    const cyl = s.cylinders?.count ?? 1;
    for (let i = 0; i < cyl; i++) {
      const x = cyl === 1 ? 0 : i === 0 ? -1.5 : 1.5;
      const base: Vec3 = [x, f.crossTop + 0.6, edge - sign * 4.5];
      const tip = v.add(v.add(hinge, v.mul(d, 2.0)), [x, 0, 0]);
      g.add(s.id, 'cylinder', 'pneumatic-cylinder', v.lerp(base, tip, 0.5), orient(v.sub(tip, base), [0, 1, 0]), { params: { d: 0.6, len: r4(v.len(v.sub(tip, base))), stroke: s.cylinders?.strokeMm ?? 50 }, step, ghost, label: 'Clamp cylinder' });
    }
    g.add(s.id, 'solenoid', 'solenoid', [2.2, f.crossTop + 0.5, edge - sign * 3], [0, 0, 0], { step, ghost, label: 'Solenoid' });
  } else {
    const motors = flattenMotors(s.motors ?? [{ type: '5.5W', count: 1 }]);
    const open = (35 - g.pose * 30) * DEG;
    for (const sx of [1, -1]) {
      const d: Vec3 = [sx * Math.sin(open), 0, sign * Math.cos(open)];
      g.plate(s.id, 'finger', 'plate-5xN-al', v.add(v.add(hinge, [sx * 1.2, 0.6, 0]), v.mul(d, 1.6)), orient(d, [0, 1, 0]), 0.5, 3.2, { step, ghost, t: 1.0, label: 'Claw finger' });
      g.add(s.id, 'gear', 'gear-hs', v.add(hinge, [sx * 1.2, 0.6, 0]), [0, 0, Math.PI / 2], { params: { teeth: 36, face: 0.5 }, step, ghost, color: g.spec.appearance.accentColor });
    }
    motors.forEach((m) => g.add(s.id, 'motor', motorPart(m), v.add(hinge, [0, 1.8, -sign * 1.5]), motorRotX(1), { params: motorParams(m), step, ghost, label: 'Claw motor' }));
  }
}

export function buildLauncher(g: Gen, s: LauncherSub, f: Frame, step: number) {
  const ghost = s.status === 'planned';
  const motors = flattenMotors(s.motors);
  const cid = g.channelId('1x2x1');
  const ms = motorSize(motorPart(motors[0]));
  if (s.variant === 'catapult') {
    const pivot: Vec3 = [0, f.crossTop + 1.0, -0.5];
    const ang = (-5 + g.pose * 80) * DEG;
    const d: Vec3 = [0, Math.sin(ang), -Math.cos(ang)];
    const len = Math.min(8, f.L / 2 - 0.5);
    for (const sx of [1, -1]) g.member(s.id, 'arm', cid, v.add(pivot, [sx * 1.5, 0, 0]), v.add(v.add(pivot, v.mul(d, len)), [sx * 1.5, 0, 0]), [sx, 0, 0], { step, ghost, label: 'Catapult arm' });
    g.plate(s.id, 'basket', 'plate-5xN-al', v.add(pivot, v.mul(d, len - 0.8)), orient(d, [0, Math.cos(ang), Math.sin(ang)] as Vec3), 3.5, 2.5, { step, ghost, label: 'Basket' });
    g.add(s.id, 'gear', 'gear-hs', [2.3, pivot[1], pivot[2]], [0, 0, 0], { params: { teeth: s.gearing?.driven ?? 84, face: 0.5, slip: 1 }, step, ghost, color: g.spec.appearance.accentColor, label: 'Slip gear' });
    motors.forEach((m, i) => g.add(s.id, 'motor', motorPart(m), [2.3 + 0.35 + ms[0] / 2 - 2 * i, pivot[1] - ((s.gearing?.driven ?? 84) + (s.gearing?.driving ?? 12)) / 48, pivot[2]], motorRotX(1), { params: motorParams(m), step, ghost, label: 'Catapult motor' }));
    const nb = Math.min(6, s.rubberBands ?? 0);
    for (let i = 0; i < nb; i++) {
      const from: Vec3 = [(i % 2 ? -1 : 1) * 1.5, f.crossTop, pivot[2] + 2 + 0.1 * i];
      const to = v.add(v.add(pivot, v.mul(d, 2.5)), [(i % 2 ? -1 : 1) * 1.5, 0, 0]);
      g.add(s.id, 'band', 'rubber-band', v.lerp(from, to, 0.5), orient(v.sub(to, from), [1, 0, 0]), { params: { len: r4(v.len(v.sub(to, from))) }, step, ghost, color: '#1E1F21' });
    }
  } else if (s.variant === 'flywheel') {
    const D = s.flywheelDiameterIn ?? 4;
    const c: Vec3 = [0, f.crossTop + 3.5, f.zR + 3];
    g.add(s.id, 'flywheel', 'traction-wheel', c, [0, 0, 0], { params: { d: D, w: 1.1, kind: 'traction' }, step, ghost, label: 'Flywheel' });
    g.shaft(s.id, -2.5, 2.5, c[1], c[2], { step, ghost });
    for (const sx of [1, -1]) g.member(s.id, 'tower', cid, [sx * 2.5, f.crossTop, c[2]], [sx * 2.5, c[1] + 1, c[2]], [-sx, 0, 0], { step, ghost, label: 'Flywheel tower' });
    g.plate(s.id, 'hood', 'poly-plate', v.add(c, [0, D / 2 + 0.6, 0.8]), [-0.5, 0, 0], 4.5, 3.5, { step, ghost, label: 'Hood', t: 0.06 });
    motors.forEach((m) => g.add(s.id, 'motor', motorPart(m), [2.5 + 0.1 + ms[0] / 2, c[1] - 1.5, c[2]], motorRotX(1), { params: motorParams(m), step, ghost, label: 'Flywheel motor' }));
  } else {
    const c: Vec3 = [0, f.crossTop + 0.8, -1];
    g.add(s.id, 'slider', 'plate-5xN-al', c, [0, 0, 0], { params: { w: 1.5, l: 6, t: 1.0 }, step, ghost, label: 'Puncher slider' });
    motors.forEach((m) => g.add(s.id, 'motor', motorPart(m), [1.8, c[1] + 0.6, c[2]], motorRotX(1), { params: motorParams(m), step, ghost, label: 'Puncher motor' }));
  }
  f.anchors[s.id] = [0, f.crossTop + 1, 0];
}

export function buildAccessory(g: Gen, s: AccessorySub, f: Frame, step: number) {
  const ghost = s.status === 'planned';
  const sides: ('left' | 'right' | 'front' | 'rear')[] = s.position === 'both-sides' ? ['left', 'right'] : [s.position];
  const len = s.lengthIn;
  const cid = g.channelId('1x2x1');
  for (const side of sides) {
    if (s.type === 'hang') {
      const z = side === 'rear' ? f.zR + 1 : side === 'front' ? f.zF - 1 : 0;
      const top: Vec3 = [0, f.crossTop + Math.min(len, 12) * (0.6 + 0.4 * g.pose), z];
      g.member(s.id, 'hang', cid, [0, f.crossTop, z], top, [0, 0, 1], { step, ghost, label: 'Hang arm' });
      g.plate(s.id, 'hook', 'flat-bar-1xN-al', v.add(top, [0, 0, 0.6]), [Math.PI / 2, 0, 0], 0.5, 1.5, { step, ghost, label: 'Hang hook' });
      continue;
    }
    const lateral = side === 'left' || side === 'right';
    const sx = side === 'right' ? 1 : -1;
    const sz = side === 'front' ? 1 : -1;
    const hinge: Vec3 = lateral ? [sx * (f.sideX - 0.2), f.crossTop + 0.6, f.zF - 1.5] : [0, f.crossTop + 0.6, sz > 0 ? f.zF : f.zR];
    const openAng = g.pose * 85 * DEG;
    let d: Vec3;
    if (lateral) d = [sx * Math.sin(openAng), 0, -Math.cos(openAng)];
    else d = [Math.cos(openAng) * 0 + Math.sin(openAng) * 0, Math.sin(openAng) * (s.type === 'hood' ? 1 : 0), sz * (s.type === 'hood' ? Math.cos(openAng) : 1)];
    if (s.type === 'descore-arm') {
      g.member(s.id, 'arm', cid, hinge, v.add(hinge, v.mul(v.norm(v.add(d, [0, 0.6, 0])), len)), [lateral ? sx : 1, 0, 0], { step, ghost, label: 'Descore arm' });
    } else {
      g.plate(s.id, s.type, 'poly-plate', v.add(hinge, v.mul(d, len / 2)), orient(d, [0, 1, 0]), 0.1, len, { step, ghost, t: 3.0, label: s.type === 'wing' ? 'Wing' : 'Hood' });
    }
    if (s.actuation === 'pneumatic') {
      const base = v.add(hinge, lateral ? [-sx * 2.5, 0, 2.5] : [0, 0, -sz * 3]);
      const tip = v.add(hinge, v.mul(d, Math.min(2.5, len / 3)));
      g.add(s.id, 'cylinder', 'pneumatic-cylinder', v.lerp(base, tip, 0.5), orient(v.sub(tip, base), [0, 1, 0]), { params: { d: 0.6, len: r4(v.len(v.sub(tip, base))), stroke: s.cylinders?.strokeMm ?? 50 }, step, ghost, label: `${s.name} cylinder` });
    } else {
      for (const m of flattenMotors(s.motors ?? [{ type: '5.5W', count: 1 }])) g.add(s.id, 'motor', motorPart(m), v.add(hinge, [0, 1.3, 0]), motorRotX(lateral ? sx : 1), { params: motorParams(m), step, ghost, label: `${s.name} motor` });
    }
  }
}

export function buildTracking(g: Gen, s: TrackingSub, f: Frame, step: number) {
  const ghost = s.status === 'planned';
  const D = s.diameterIn;
  const spots: { pos: Vec3; rot: Vec3 }[] = [
    { pos: [1.5, D / 2, 0], rot: [0, 0, 0] },
    { pos: [0, D / 2, -2.5], rot: [0, Math.PI / 2, 0] },
    { pos: [-1.5, D / 2, 0], rot: [0, 0, 0] },
  ];
  for (let i = 0; i < Math.min(3, s.count); i++) {
    const sp = spots[i];
    g.add(s.id, 'wheel', 'omni-wheel', sp.pos, sp.rot, { params: { d: D, w: 0.9, kind: 'omni' }, step, ghost, label: 'Tracking wheel' });
    g.add(s.id, 'sensor', 'rotation', v.add(sp.pos, sp.rot[1] ? [0, 0, 0.8] : [0.8, 0, 0]), sp.rot, { step, ghost, label: 'Tracking rotation sensor' });
  }
  f.anchors[s.id] = [0, D / 2, 0];
}
