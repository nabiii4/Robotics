import { WHEEL_WIDTH, channelProfile } from '../catalog';
import { basisToEuler, r4, v, type Vec3 } from '../math';
import type { Gen, Frame } from './core';
import { STEP, motorSize } from './core';

const SUB = 'drivetrain';
const snapUp = (n: number) => Math.ceil(n / 0.5) * 0.5;
const snapHole = (z: number, zR: number) => zR + 0.25 + Math.round((z - zR - 0.25) / 0.5) * 0.5;

function motorRot(outward: 1 | -1): Vec3 {
  // local X = shaft (outward), local Y (2.82) along world Z, local Z (2.26) vertical
  const x: Vec3 = [outward, 0, 0];
  const y: Vec3 = [0, 0, 1];
  return basisToEuler(x, y, v.cross(x, y));
}

function motorRotAxis(axis: Vec3): Vec3 {
  const x = v.norm(axis);
  const y: Vec3 = [0, 1, 0];
  const z = v.cross(x, y);
  return basisToEuler(x, v.cross(z, x), z);
}

export function buildDrivetrain(g: Gen): Frame {
  const dt = g.spec.drivetrain;
  const D = dt.wheel.diameterIn;
  const r = D / 2;
  const kind = dt.wheel.kind;
  const ww = WHEEL_WIDTH[`${kind}-${D}`] ?? 1.0;
  const railId = g.channelId(dt.railChannel);
  const n = channelProfile(dt.railChannel);
  const T = dt.trackWidthIn, B = dt.wheelBaseIn;
  const axleY = r;
  const webBottom = axleY - 0.25;
  const webH = n * 0.5;
  const webCY = webBottom + webH / 2;
  const railTop = webBottom + webH;
  const crossTop = railTop + 0.5;
  const geared = !!dt.gearing;
  const cd = geared ? (dt.gearing!.driving + dt.gearing!.driven) / 48 : 0;
  const notes: string[] = [];
  if (geared && Math.abs(cd / 0.5 - Math.round(cd / 0.5)) > 1e-6) notes.push(`Drive gears ${dt.gearing!.driving}:${dt.gearing!.driven} mesh at ${cd.toFixed(2)} in — requires offset/slotted mounting.`);

  const mIdPart = dt.motors.type === '5.5W' ? 'motor-5.5w' : 'motor-11w';
  const cart = dt.motors.type === '11W' ? dt.motors.cartridge ?? 'green' : undefined;
  const mParams = cart ? { cartridge: cart } : undefined;
  const mSize = motorSize(mIdPart);

  if (dt.type === 'xdrive') return buildXDrive(g, { D, r, ww, railId, webCY, webBottom, railTop, crossTop, axleY, mIdPart, mParams, mSize, notes });

  const wheelsPerSide = dt.type === 'mecanum' ? 2 : dt.wheelsPerSide;
  const outboard = dt.wheelMount === 'outboard' || dt.type === 'mecanum';
  const L = snapUp(B + D + 0.5);
  const zF = L / 2, zR = -L / 2;
  const perSide = Math.max(1, Math.round(dt.motors.count / 2));

  // wheel z positions (on the rail hole grid)
  const zs = Array.from({ length: wheelsPerSide }, (_, i) => snapHole(-B / 2 + (i * B) / (wheelsPerSide - 1), zR));
  const powered = new Set<number>();
  if (perSide >= wheelsPerSide) zs.forEach((_, i) => powered.add(i));
  else if (perSide === 1) powered.add(0);
  else for (let k = 0; k < perSide; k++) powered.add(Math.round((k * (wheelsPerSide - 1)) / (perSide - 1)));
  const chained = powered.size < wheelsPerSide;

  let innerX: number, outerX: number, railX: number;
  if (outboard) {
    railX = T / 2 - ww / 2 - 0.35;
    innerX = railX; outerX = railX;
  } else {
    outerX = T / 2 + ww / 2 + 0.2;
    innerX = T / 2 - ww / 2 - 0.2 - (geared ? 0.6 : 0) - (chained ? 0.35 : 0);
    railX = innerX;
  }

  // rails
  for (const s of [1, -1] as const) {
    if (outboard) {
      g.member(SUB, 'rail', railId, [s * railX, webCY, zR], [s * railX, webCY, zF], [-s, 0, 0], { step: STEP.frame, label: `${s > 0 ? 'Right' : 'Left'} rail` });
    } else {
      g.member(SUB, 'rail-outer', railId, [s * outerX, webCY, zR], [s * outerX, webCY, zF], [s, 0, 0], { step: STEP.frame, label: `${s > 0 ? 'Right' : 'Left'} outer rail` });
      g.member(SUB, 'rail-inner', railId, [s * innerX, webCY, zR], [s * innerX, webCY, zF], [-s, 0, 0], { step: STEP.frame, label: `${s > 0 ? 'Right' : 'Left'} inner rail` });
    }
  }
  // crossbraces (flanges down, resting on the inner rails)
  const cbZ = [zF - 0.5, zR + 0.5];
  if (dt.crossbraces >= 3) cbZ.push(0);
  if (dt.crossbraces >= 4) { cbZ.pop(); cbZ.push(snapHole(L / 6, zR), snapHole(-L / 6, zR)); }
  const cbHalf = innerX + 0.25;
  cbZ.forEach((z) => g.member(SUB, 'crossbrace', g.channelId('1x2x1'), [-cbHalf, railTop + 0.5, z], [cbHalf, railTop + 0.5, z], [0, -1, 0], { step: STEP.frame, label: 'Crossbrace' }));

  // wheels, axles, motors, gears, chain
  const wheelPart = kind === 'mecanum' ? 'mecanum-wheel' : kind === 'traction' ? 'traction-wheel' : 'omni-wheel';
  for (const s of [1, -1] as const) {
    zs.forEach((z, i) => {
      const isMid = i > 0 && i < zs.length - 1;
      const thisPart = kind !== 'mecanum' && dt.centerWheelsTraction && isMid ? 'traction-wheel' : wheelPart;
      const params: Record<string, number | string> = { d: D, w: ww, kind: thisPart.replace('-wheel', '') };
      if (kind === 'mecanum') params.hand = (s > 0) === (z > 0) ? 'A' : 'B';
      g.add(SUB, 'wheel', thisPart, [s * T / 2, axleY, z], [0, 0, 0], { params, step: STEP.wheels, label: `${s > 0 ? 'Right' : 'Left'} ${i === 0 ? 'rear' : i === zs.length - 1 ? 'front' : 'middle'} wheel` });
      const x0 = outboard ? s * (railX - 0.3) : s * (innerX - 0.3);
      const x1 = s * (T / 2 + ww / 2 - 0.05);
      g.shaft(SUB, x0, x1, axleY, z, { step: STEP.wheels });
      const gearX = s * (T / 2 - ww / 2 - 0.45);
      if (powered.has(i)) {
        const mx = s * (innerX - 0.55 - mSize[0] / 2);
        if (geared) {
          g.add(SUB, 'gear', 'gear-hs', [gearX, axleY, z], [0, 0, 0], { params: { teeth: dt.gearing!.driven, face: 0.5 }, step: STEP.driveMotors, color: g.spec.appearance.accentColor });
          g.add(SUB, 'pinion', 'gear-hs', [gearX, axleY + cd, z], [0, 0, 0], { params: { teeth: dt.gearing!.driving, face: 0.5 }, step: STEP.driveMotors, color: g.spec.appearance.accentColor });
          g.shaft(SUB, gearX, mx, axleY + cd, z, { step: STEP.driveMotors });
          g.add(SUB, 'motor', mIdPart, [mx, axleY + cd, z], motorRot(s), { params: mParams, step: STEP.driveMotors, label: `${s > 0 ? 'Right' : 'Left'} drive motor` });
        } else {
          g.add(SUB, 'motor', mIdPart, [mx, axleY, z], motorRot(s), { params: mParams, step: STEP.driveMotors, label: `${s > 0 ? 'Right' : 'Left'} drive motor` });
        }
      }
      if (chained) {
        const sx = s * (T / 2 - ww / 2 - 0.2 - (geared ? 0.6 : 0) - 0.15);
        g.add(SUB, 'sprocket', 'sprocket', [sx, axleY, z], [0, 0, 0], { params: { teeth: 12, face: 0.12 }, step: STEP.driveMotors, color: '#2B2E33' });
      }
    });
    if (chained) {
      const sx = s * (T / 2 - ww / 2 - 0.2 - (geared ? 0.6 : 0) - 0.15);
      const sr = 12 / 24 / 2 + 0.05;
      for (let i = 0; i < zs.length - 1; i++) {
        const len = zs[i + 1] - zs[i];
        for (const dy of [sr, -sr]) g.add(SUB, 'chain', 'chain', [sx, axleY + dy, (zs[i] + zs[i + 1]) / 2], [0, 0, 0], { params: { len: r4(len) }, step: STEP.driveMotors });
      }
    }
  }

  // H-drive strafe wheel
  if (dt.type === 'hdrive' && dt.hWheel) {
    const hd = dt.hWheel.diameterIn;
    const hr = hd / 2;
    const hw = WHEEL_WIDTH[`omni-${hd}`] ?? 1.0;
    g.add(SUB, 'h-wheel', 'omni-wheel', [0, hr, 0], [0, Math.PI / 2, 0], { params: { d: hd, w: hw, kind: 'omni' }, step: STEP.wheels, label: 'H strafe wheel' });
    for (const s of [1, -1]) g.member(SUB, 'h-mount', g.channelId('1x2x1'), [s * (hw / 2 + 0.35), railTop, -2], [s * (hw / 2 + 0.35), railTop, 2], [s, 0, 0], { step: STEP.wheels, hardware: false });
    const hid = dt.hWheel.motors.type === '5.5W' ? 'motor-5.5w' : 'motor-11w';
    g.add(SUB, 'h-motor', hid, [0, hr, -hw / 2 - 0.9], motorRotAxis([0, 0, -1]), { params: dt.hWheel.motors.type === '11W' ? { cartridge: dt.hWheel.motors.cartridge ?? 'green' } : undefined, step: STEP.driveMotors, label: 'H-wheel motor' });
  }

  const sideX = outboard ? T / 2 + ww / 2 : outerX + 0.5;
  return {
    L, zF, zR, axleY, wheelR: r, wheelW: ww, webBottom, railTop, crossTop,
    innerX, outerX, railX, sideX, towerX: outboard ? railX : innerX,
    anchors: { chassis: [0, crossTop, 0] }, notes,
  };
}

function buildXDrive(g: Gen, c: {
  D: number; r: number; ww: number; railId: string; webCY: number; webBottom: number; railTop: number; crossTop: number; axleY: number;
  mIdPart: string; mParams?: Record<string, string>; mSize: [number, number, number]; notes: string[];
}): Frame {
  const dt = g.spec.drivetrain;
  const a = dt.trackWidthIn / 2;
  const chamfer = 2.5;
  const d = c.ww / 2 + 0.35;
  const h = snapUp(a + chamfer / 2 - d / Math.SQRT2 + 0.25) - 0.25;
  // side rails
  const corners: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  g.member(SUB, 'rail', c.railId, [-h + chamfer, c.webCY, h], [h - chamfer, c.webCY, h], [0, 0, -1], { step: STEP.frame, label: 'Front rail' });
  g.member(SUB, 'rail', c.railId, [-h + chamfer, c.webCY, -h], [h - chamfer, c.webCY, -h], [0, 0, 1], { step: STEP.frame, label: 'Rear rail' });
  g.member(SUB, 'rail', c.railId, [h, c.webCY, -h + chamfer], [h, c.webCY, h - chamfer], [-1, 0, 0], { step: STEP.frame, label: 'Right rail' });
  g.member(SUB, 'rail', c.railId, [-h, c.webCY, -h + chamfer], [-h, c.webCY, h - chamfer], [1, 0, 0], { step: STEP.frame, label: 'Left rail' });
  for (const [sx, sz] of corners) {
    g.member(SUB, 'chamfer', c.railId, [sx * (h - chamfer), c.webCY, sz * h], [sx * h, c.webCY, sz * (h - chamfer)], [-sx, 0, -sz], { step: STEP.frame, label: 'Corner rail' });
  }
  g.member(SUB, 'crossbrace', g.channelId('1x2x1'), [-h, c.railTop + 0.5, 0], [h, c.railTop + 0.5, 0], [0, -1, 0], { step: STEP.frame, label: 'Crossbrace' });
  const wheelPart = 'omni-wheel';
  for (const [sx, sz] of corners) {
    const axis = v.norm([sx, 0, sz] as Vec3);
    const mid: Vec3 = [sx * (h - chamfer / 2), c.axleY, sz * (h - chamfer / 2)];
    const center = v.add(mid, v.mul(axis, d));
    const rotY = Math.atan2(-axis[2], axis[0]);
    g.add(SUB, 'wheel', wheelPart, center, [0, r4(rotY), 0], { params: { d: c.D, w: c.ww, kind: 'omni' }, step: STEP.wheels, label: 'Corner wheel' });
    const mc = v.sub(mid, v.mul(axis, 0.55 + c.mSize[0] / 2));
    g.add(SUB, 'motor', c.mIdPart, mc, motorRotAxis(axis), { params: c.mParams, step: STEP.driveMotors, label: 'Drive motor' });
  }
  const zF = h + 0.5, zR = -h - 0.5;
  return {
    L: zF - zR, zF, zR, axleY: c.axleY, wheelR: c.r, wheelW: c.ww, webBottom: c.webBottom, railTop: c.railTop, crossTop: c.crossTop,
    innerX: h - 0.5, outerX: h, railX: h, sideX: h + 1.5, towerX: h,
    anchors: { chassis: [0, c.crossTop, 0] }, notes: c.notes,
  };
}
