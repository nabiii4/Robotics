import { describe, expect, it } from 'vitest';
import type { Gearing } from '@/lib/robot/spec';
import { externalRatio, gearCenterIn, motorPowerW, motorRpm, pushLbf, topSpeedInPerS, wheelTravelMm } from '@/lib/robot/metrics';
import { derive } from '@/lib/robot/derive';
import { TEMPLATES } from '@/lib/robot/defaults';

const speed = (cart: 'red' | 'green' | 'blue', g: Gearing | null, d: number) => {
  const rpm = motorRpm({ type: '11W', cartridge: cart }) * externalRatio(g);
  return { rpm, ips: Math.round(topSpeedInPerS(rpm, d) * 100) / 100 };
};

describe('metrics golden values (spec §13.4)', () => {
  it('blue 600 · 36:48 · 3.25″ → 450 rpm, 76.58 in/s', () => {
    const s = speed('blue', { driving: 36, driven: 48 }, 3.25);
    expect(s.rpm).toBe(450);
    expect(s.ips).toBeCloseTo(76.58, 2);
    expect(Math.round((s.ips / 12) * 100) / 100).toBeCloseTo(6.38, 2);
  });
  it('green 200 · direct · 4″ → 200 rpm, 41.89 in/s', () => {
    const s = speed('green', null, 4);
    expect(s.rpm).toBe(200);
    expect(s.ips).toBeCloseTo(41.89, 2);
  });
  it('blue 600 · 36:60 · 4″ → 360 rpm, 75.40 in/s', () => {
    const s = speed('blue', { driving: 36, driven: 60 }, 4);
    expect(s.rpm).toBe(360);
    expect(s.ips).toBeCloseTo(75.4, 2);
  });
  it('6 × blue 11 W · 36:48 · 3.25″ → ≈15.25 lbf theoretical push', () => {
    expect(pushLbf({ type: '11W', count: 6, cartridge: 'blue' }, { driving: 36, driven: 48 }, 3.25)).toBeCloseTo(15.25, 1);
  });
  it('motor power sums', () => {
    expect(motorPowerW([{ type: '11W', count: 6, cartridge: 'blue' }, { type: '5.5W', count: 1 }])).toBe(71.5);
    expect(motorPowerW([{ type: '11W', count: 8, cartridge: 'blue' }])).toBe(88);
    expect(motorPowerW([{ type: '11W', count: 8, cartridge: 'blue' }, { type: '5.5W', count: 1 }])).toBe(93.5);
  });
  it('gear centers (24 DP)', () => {
    expect([gearCenterIn(36, 48), gearCenterIn(12, 60), gearCenterIn(12, 84), gearCenterIn(36, 60)]).toEqual([1.75, 1.5, 2, 2]);
  });
  it('wheel travel per revolution', () => {
    expect([2.75, 3.25, 4].map((d) => Math.round(wheelTravelMm(d) * 100) / 100)).toEqual([219.44, 259.34, 319.19]);
  });
});

describe('motor power rule', () => {
  const base = TEMPLATES['competition-base'].spec('Power test');
  const withMotors = (driveCount: number) => ({ ...base, drivetrain: { ...base.drivetrain, motors: { ...base.drivetrain.motors, count: driveCount } } });
  it('6 × 11 W + 1 × 5.5 W passes (71.5 W)', () => {
    const d = derive(withMotors(6));
    expect(d.metrics.motorPowerW).toBe(71.5);
    expect(d.ruleChecks.find((c) => c.id === 'power.motors')?.pass).toBe(true);
  });
  it('8 × 11 W + 1 × 5.5 W fails (93.5 W)', () => {
    const d = derive(withMotors(8));
    expect(d.metrics.motorPowerW).toBe(93.5);
    const c = d.ruleChecks.find((x) => x.id === 'power.motors');
    expect(c?.pass).toBe(false);
    expect(c?.severity).toBe('error');
  });
});
