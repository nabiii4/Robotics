import { describe, expect, it } from 'vitest';
import { derive } from '@/lib/robot/derive';
import { generate } from '@/lib/robot/generator';
import { SEED_SPEC, TEMPLATES } from '@/lib/robot/defaults';
import { normalizeSpec } from '@/lib/robot/normalize';
import { diffSpecs } from '@/lib/robot/diff';
import { failingErrors } from '@/lib/robot/rules';

const specs = { seed: SEED_SPEC, ...Object.fromEntries(Object.entries(TEMPLATES).map(([k, t]) => [k, t.spec(k)])) };

describe.each(Object.entries(specs))('generator invariants — %s', (_name, spec) => {
  const d = derive(spec);
  it('produces parts, steps and a BOM', () => {
    expect(d.gen.parts.length).toBeGreaterThan(20);
    expect(d.gen.steps.length).toBeGreaterThan(2);
    expect(d.bom.length).toBeGreaterThan(5);
  });
  it('is deterministic', () => {
    const a = generate(d.spec, { pose: 0 }).parts.map((p) => `${p.uid}:${p.position.join(',')}`);
    const b = generate(d.spec, { pose: 0 }).parts.map((p) => `${p.uid}:${p.position.join(',')}`);
    expect(a).toEqual(b);
  });
  it('has unique part uids and every part in a step', () => {
    const uids = d.gen.parts.map((p) => p.uid);
    expect(new Set(uids).size).toBe(uids.length);
    const stepped = new Set(d.gen.steps.flatMap((s) => s.partUids));
    expect(d.gen.parts.filter((p) => !stepped.has(p.uid)).length).toBe(0);
  });
  it('assigns unique smart ports', () => {
    const ports = d.devices.filter((x) => typeof x.port === 'number').map((x) => x.port);
    expect(new Set(ports).size).toBe(ports.length);
    expect(ports.every((p) => Number(p) >= 1 && Number(p) <= 21)).toBe(true);
  });
  it('passes every error-level rule check', () => {
    expect(failingErrors(d.ruleChecks).map((c) => c.title)).toEqual([]);
  });
});

describe('seed robot (Appendix D)', () => {
  it('fits the 18″ starting box at 17.8 × 16.0 × 14.5 in', () => {
    const m = derive(SEED_SPEC).metrics.startSize;
    expect([m.length, m.width, m.height]).toEqual([17.8, 16, 14.5]);
  });
});

describe('normalize + diff', () => {
  it('clamps silly values and reports them', () => {
    const bad = { ...SEED_SPEC, drivetrain: { ...SEED_SPEC.drivetrain, trackWidthIn: 99 } };
    const r = normalizeSpec(bad);
    expect(r.spec.drivetrain.trackWidthIn).toBeLessThan(99);
    expect(r.report.length).toBeGreaterThan(0);
  });
  it('describes a cartridge change', () => {
    const b = { ...SEED_SPEC, drivetrain: { ...SEED_SPEC.drivetrain, motors: { ...SEED_SPEC.drivetrain.motors, cartridge: 'blue' as const } } };
    const lines = diffSpecs(SEED_SPEC, normalizeSpec(b).spec);
    expect(lines.join(' ')).toMatch(/blue/i);
  });
});
