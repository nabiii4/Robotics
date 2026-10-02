import type { RobotSpec, Subsystem } from './spec';
import type { Metrics } from './metrics';
import { motorRpm, externalRatio } from './metrics';

const cartLabel = (m: RobotSpec['drivetrain']['motors']) => (m.type === '5.5W' ? '5.5 W' : `${m.cartridge} ${motorRpm(m)} rpm`);
const wheelLabel = (d: RobotSpec['drivetrain']) => `${d.wheel.diameterIn}″ ${d.wheel.kind}`;
const subLabel = (s: Subsystem) => {
  const pos = 'position' in s && s.position ? ` (${s.position})` : '';
  return `${s.name}${pos}`;
};

/** Plain-English structural diff between two specs plus metric deltas (spec §13.6). */
export function diffSpecs(a: RobotSpec | null, b: RobotSpec, ma?: Metrics | null, mb?: Metrics | null): string[] {
  const out: string[] = [];
  if (!a) {
    out.push(`New design: ${b.drivetrain.motors.count}-motor ${b.drivetrain.type} on ${wheelLabel(b.drivetrain)} wheels`);
    b.subsystems.forEach((s) => out.push(`Subsystem: ${subLabel(s)}`));
    return out;
  }
  const da = a.drivetrain, db = b.drivetrain;
  if (da.type !== db.type || da.motors.count !== db.motors.count || da.motors.cartridge !== db.motors.cartridge || da.motors.type !== db.motors.type || JSON.stringify(da.gearing) !== JSON.stringify(db.gearing)) {
    const gear = db.gearing ? `, ${db.gearing.driving}:${db.gearing.driven} → ${Math.round(motorRpm(db.motors) * externalRatio(db.gearing))} rpm at the wheel` : '';
    const typePart = da.type !== db.type ? `${da.type} → ${db.type}, ` : '';
    out.push(`Drivetrain: ${typePart}${da.motors.count} → ${db.motors.count} motors (${cartLabel(db.motors)}${gear})`);
  }
  if (da.wheel.kind !== db.wheel.kind || da.wheel.diameterIn !== db.wheel.diameterIn) out.push(`Wheels: ${wheelLabel(da)} → ${wheelLabel(db)}`);
  if (da.trackWidthIn !== db.trackWidthIn) out.push(`Track width: ${da.trackWidthIn} → ${db.trackWidthIn} in`);
  if (da.wheelBaseIn !== db.wheelBaseIn) out.push(`Wheelbase: ${da.wheelBaseIn} → ${db.wheelBaseIn} in`);
  if (da.wheelsPerSide !== db.wheelsPerSide) out.push(`Wheels per side: ${da.wheelsPerSide} → ${db.wheelsPerSide}`);
  if (da.wheelMount !== db.wheelMount) out.push(`Wheel mount: ${da.wheelMount} → ${db.wheelMount}`);

  const byId = new Map(a.subsystems.map((s) => [s.id, s]));
  const seen = new Set<string>();
  for (const s of b.subsystems) {
    const old = byId.get(s.id);
    seen.add(s.id);
    if (!old) { out.push(`Added subsystem: ${subLabel(s)}${s.status === 'planned' ? ' — planned' : ''}`); continue; }
    const changes: string[] = [];
    if (old.type !== s.type) changes.push(`${old.type} → ${s.type}`);
    if ('variant' in old && 'variant' in s && old.variant !== s.variant) changes.push(`${old.variant} → ${s.variant}`);
    const om = ('motors' in old ? old.motors : undefined) ?? [], nm = ('motors' in s ? s.motors : undefined) ?? [];
    const mc = (ms: typeof om) => ms.reduce((t, m) => t + m.count, 0);
    if (mc(om) !== mc(nm) || JSON.stringify(om) !== JSON.stringify(nm)) changes.push(`${mc(om)} → ${mc(nm)} motor${mc(nm) === 1 ? '' : 's'}${nm[0] ? ` (${nm.map((m) => (m.type === '5.5W' ? '5.5 W' : `${m.cartridge ?? ''} 11 W`)).join(', ')})` : ''}`);
    if ('gearing' in old && 'gearing' in s && JSON.stringify(old.gearing) !== JSON.stringify(s.gearing)) changes.push(s.gearing ? `${s.gearing.driving}:${s.gearing.driven} reduction` : 'direct drive');
    if (s.type === 'lift' && old.type === 'lift') {
      if (old.towerHeightIn !== s.towerHeightIn) changes.push(`tower ${old.towerHeightIn} → ${s.towerHeightIn} in`);
      if (old.armLengthIn !== s.armLengthIn) changes.push(`arm ${old.armLengthIn} → ${s.armLengthIn} in`);
      if (old.rubberBands !== s.rubberBands) changes.push(`${s.rubberBands} rubber bands`);
    }
    if (s.type === 'intake' && old.type === 'intake') {
      if (old.stages !== s.stages) changes.push(`${old.stages} → ${s.stages} stages`);
      if (old.rollerCount !== s.rollerCount) changes.push(`${old.rollerCount} → ${s.rollerCount} rollers`);
      if (old.widthIn !== s.widthIn) changes.push(`width ${old.widthIn} → ${s.widthIn} in`);
      if (old.position !== s.position) changes.push(`moved to the ${s.position}`);
    }
    if (old.status !== s.status) changes.push(`status ${old.status.replace('_', ' ')} → ${s.status.replace('_', ' ')}`);
    if (old.name !== s.name) changes.push(`renamed from ${old.name}`);
    if (changes.length) out.push(`${s.name}: ${changes.join(', ')}`);
  }
  for (const s of a.subsystems) if (!seen.has(s.id)) out.push(`Removed subsystem: ${subLabel(s)}`);

  const sa = new Set(a.sensors.map((s) => `${s.type}:${s.attachTo ?? ''}`));
  const sb = new Set(b.sensors.map((s) => `${s.type}:${s.attachTo ?? ''}`));
  for (const k of sb) if (!sa.has(k)) out.push(`Added sensor: ${k.split(':')[0]}${k.split(':')[1] ? ` on ${k.split(':')[1]}` : ''}`);
  for (const k of sa) if (!sb.has(k)) out.push(`Removed sensor: ${k.split(':')[0]}`);
  const ea = a.electronics, eb = b.electronics;
  if (ea.brainMount !== eb.brainMount) out.push(`Brain mount: ${ea.brainMount} → ${eb.brainMount}`);
  if (ea.pneumatics.airTanks !== eb.pneumatics.airTanks) out.push(`Air tanks: ${ea.pneumatics.airTanks} → ${eb.pneumatics.airTanks}`);
  if (a.meta.program !== b.meta.program) out.push(`Program: ${a.meta.program} → ${b.meta.program}`);
  if (a.appearance.accentColor !== b.appearance.accentColor || a.appearance.rollerColor !== b.appearance.rollerColor) out.push('Appearance updated');

  if (ma && mb) {
    if (Math.abs(ma.topSpeedInPerS - mb.topSpeedInPerS) >= 0.05) out.push(`Top speed: ${ma.topSpeedInPerS.toFixed(1)} → ${mb.topSpeedInPerS.toFixed(1)} in/s`);
    const s1 = ma.startSize, s2 = mb.startSize;
    if (s1.length !== s2.length || s1.width !== s2.width || s1.height !== s2.height) out.push(`Start size: ${s1.length.toFixed(1)} × ${s1.width.toFixed(1)} × ${s1.height.toFixed(1)} in → ${s2.length.toFixed(1)} × ${s2.width.toFixed(1)} × ${s2.height.toFixed(1)} in`);
    if (ma.motorPowerW !== mb.motorPowerW) out.push(`Motor power: ${ma.motorPowerW} → ${mb.motorPowerW} W`);
    if (Math.abs(ma.weightLb - mb.weightLb) >= 0.1) out.push(`Weight (est.): ${ma.weightLb.toFixed(1)} → ${mb.weightLb.toFixed(1)} lb`);
  }
  if (!out.length) out.push('No design changes');
  return out;
}
