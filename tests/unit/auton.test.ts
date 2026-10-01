import { describe, expect, it } from 'vitest';
import { frameAt, parseAuton, simulate } from '@/lib/vexcode/auton';

const files = [
  { path: 'src/main.cpp', content: 'void autonomous(void) {\n  drive.setDriveVelocity(100, percent);\n  drive.driveFor(forward, 24, inches);\n  drive.turnFor(right, 90, degrees);\n  auton();\n  piston.set(true);\n  mystery(1);\n}\n' },
  { path: 'include/autonomous.h', content: 'void auton() {\n  drive.driveFor(reverse, 254, mm);\n  wait(1, seconds);\n}\n' },
];

describe('auton preview', () => {
  const p = parseAuton(files);
  it('parses supported calls, inlines helpers, lists skipped lines', () => {
    expect(p.fn).toBe('autonomous');
    expect(p.cmds.map((c) => c.kind)).toEqual(['driveVel', 'drive', 'turn', 'drive', 'wait', 'event']);
    expect(p.skipped.map((s) => s.text)).toEqual(['mystery(1)']);
  });
  it('simulates position and heading', () => {
    const s = simulate(p.cmds, { wheelRpm: 200, wheelDiameterIn: 4, trackWidthIn: 12 }, { x: 72, y: 24, heading: 0 });
    const end = s.frames[s.frames.length - 1];
    expect(end.h).toBeCloseTo(90);
    expect(end.y).toBeCloseTo(48, 1); // forward 24 in north
    expect(end.x).toBeCloseTo(62, 1); // then 10 in backwards facing east
    expect(s.total).toBeGreaterThan(1);
    expect(frameAt(s, 0).x).toBe(72);
  });
});
