import { describe, expect, it } from 'vitest';
import { includePolicy, parseGccOutput, syntaxCheck, vexLint } from '@/lib/vexcode/check';

describe('include policy (spec §18.5)', () => {
  const f = (content: string) => [{ path: 'src/main.cpp', content }, { path: 'include/vex.h', content: '' }];
  it('allows project headers and the whitelist', () => {
    expect(includePolicy(f('#include "vex.h"\n#include <cmath>\n#include <vector>'))).toEqual([]);
  });
  it.each([
    ['#include </etc/passwd>', /not allowed/],
    ['#include "../../secret.h"', /not allowed/],
    ['#include <fstream>', /isn't available/],
    ['#include_next <stdio.h>', /include_next/],
    ['#if __has_include(<x>)\n#endif', /__has_include/],
    ['#include "missing.h"', /not found/],
  ])('rejects %s', (src, msg) => {
    const d = includePolicy(f(src));
    expect(d.length).toBeGreaterThan(0);
    expect(d.map((x) => x.message).join(' ')).toMatch(msg);
  });
  it('limits file size', () => {
    expect(includePolicy([{ path: 'src/big.cpp', content: 'x'.repeat(210 * 1024) }])[0].message).toMatch(/200 KB/);
  });
});

describe('fallback checker', () => {
  it('finds an unclosed brace', () => {
    expect(syntaxCheck({ path: 'src/a.cpp', content: 'void f() {\n  int x = 1;\n' }).some((d) => /never closed/.test(d.message))).toBe(true);
  });
  it('finds a missing semicolon', () => {
    expect(syntaxCheck({ path: 'src/a.cpp', content: 'void f() {\n  drive.stop()\n  wait(20, msec);\n}\n' }).some((d) => /expected ';'/.test(d.message))).toBe(true);
  });
  it('accepts clean code', () => {
    expect(syntaxCheck({ path: 'src/a.cpp', content: 'void f() {\n  if (x) {\n    drive.stop();\n  }\n}\n' })).toEqual([]);
  });
  it('VEX lint: unknown device, loop without wait, bad units', () => {
    const d = vexLint([{ path: 'src/main.cpp', content: 'void usercontrol() {\n  while (true) {\n    intakeMotr.spin(forward);\n  }\n}\nvoid a() { drive.driveFor(forward, 10, feet); }\n' }], ['intakeMotor', 'drive']);
    const msgs = d.map((x) => x.message).join('\n');
    expect(msgs).toMatch(/intakeMotr/);
    expect(msgs).toMatch(/no wait/);
    expect(msgs).toMatch(/feet/);
  });
  it('parses g++ output and hides stub headers', () => {
    const out = '/tmp/x/src/main.cpp:12:5: error: foo\n/tmp/x/vex_stub/v5.h:1:1: note: bar\n/tmp/x/src/main.cpp:3:1: warning: baz';
    const d = parseGccOutput(out, '/tmp/x');
    expect(d).toEqual([{ file: 'src/main.cpp', line: 12, col: 5, severity: 'error', message: 'foo' }, { file: 'src/main.cpp', line: 3, col: 1, severity: 'warning', message: 'baz' }]);
  });
});
