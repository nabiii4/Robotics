// Auton Preview (spec §18.6): parse the autonomous routine and simulate it on a 12 ft field. Pure — runs in the browser.
import { stripCode, type ProjectFile } from './check';

export type AutonCmd =
  | { kind: 'drive'; inches: number; line: number; file: string; text: string }
  | { kind: 'turn'; degrees: number; line: number; file: string; text: string }
  | { kind: 'turnTo'; heading: number; line: number; file: string; text: string }
  | { kind: 'wait'; seconds: number; line: number; file: string; text: string }
  | { kind: 'driveVel'; percent: number; line: number; file: string; text: string }
  | { kind: 'turnVel'; percent: number; line: number; file: string; text: string }
  | { kind: 'event'; label: string; seconds: number; line: number; file: string; text: string };

export interface ParsedAuton { fn: string | null; file: string | null; cmds: AutonCmd[]; skipped: { line: number; file: string; text: string }[] }

const NUM = '(-?\\d+(?:\\.\\d+)?)';
const UNIT_IN: Record<string, number> = { inches: 1, mm: 1 / 25.4, cm: 1 / 2.54 };

function findBody(files: ProjectFile[], name: string): { file: string; body: string; startLine: number } | null {
  for (const f of files) {
    if (!/\.(cpp|h|hpp)$/.test(f.path)) continue;
    const code = stripCode(f.content);
    const re = new RegExp(`\\bvoid\\s+${name}\\s*\\(\\s*(void)?\\s*\\)\\s*\\{`, 'g');
    const m = re.exec(code);
    if (!m) continue;
    const start = m.index + m[0].length;
    let depth = 1, k = start;
    while (k < code.length && depth > 0) { if (code[k] === '{') depth++; else if (code[k] === '}') depth--; k++; }
    return { file: f.path, body: f.content.slice(start, k - 1), startLine: code.slice(0, start).split('\n').length };
  }
  return null;
}

export function parseAuton(files: ProjectFile[], prefer = ['autonomous', 'auton']): ParsedAuton {
  let found: ReturnType<typeof findBody> = null;
  let fn: string | null = null;
  for (const n of prefer) { found = findBody(files, n); if (found) { fn = n; break; } }
  const out: ParsedAuton = { fn, file: found?.file ?? null, cmds: [], skipped: [] };
  if (!found) return out;
  const walk = (b: NonNullable<ReturnType<typeof findBody>>, depth: number) => {
    const lines = b.body.split('\n');
    lines.forEach((raw, i) => {
      const line = b.startLine + i;
      const text = raw.replace(/\/\/.*$/, '').trim();
      if (!text || text === '{' || text === '}') return;
      for (const stmt of text.split(';').map((s) => s.trim()).filter(Boolean)) {
        const at = { line, file: b.file, text: stmt };
        let m: RegExpMatchArray | null;
        if ((m = stmt.match(new RegExp(`\\w+\\.driveFor\\(\\s*(?:(forward|reverse|fwd|rev)\\s*,\\s*)?${NUM}\\s*,\\s*(inches|mm|cm)`)))) {
          const sign = m[1] === 'reverse' || m[1] === 'rev' ? -1 : 1;
          out.cmds.push({ kind: 'drive', inches: sign * Number(m[2]) * UNIT_IN[m[3]], ...at });
        } else if ((m = stmt.match(new RegExp(`\\w+\\.turnFor\\(\\s*(?:(left|right)\\s*,\\s*)?${NUM}\\s*,\\s*degrees`)))) {
          out.cmds.push({ kind: 'turn', degrees: (m[1] === 'left' ? -1 : 1) * Number(m[2]), ...at });
        } else if ((m = stmt.match(new RegExp(`\\w+\\.turnToHeading\\(\\s*${NUM}\\s*,\\s*degrees`)))) {
          out.cmds.push({ kind: 'turnTo', heading: Number(m[1]), ...at });
        } else if ((m = stmt.match(new RegExp(`\\w+\\.setDriveVelocity\\(\\s*${NUM}\\s*,\\s*percent`)))) {
          out.cmds.push({ kind: 'driveVel', percent: Number(m[1]), ...at });
        } else if ((m = stmt.match(new RegExp(`\\w+\\.setTurnVelocity\\(\\s*${NUM}\\s*,\\s*percent`)))) {
          out.cmds.push({ kind: 'turnVel', percent: Number(m[1]), ...at });
        } else if ((m = stmt.match(new RegExp(`^wait\\(\\s*${NUM}\\s*,\\s*(msec|seconds|sec)\\s*\\)$`)))) {
          out.cmds.push({ kind: 'wait', seconds: m[2] === 'msec' ? Number(m[1]) / 1000 : Number(m[1]), ...at });
        } else if ((m = stmt.match(new RegExp(`^(\\w+)\\.spinFor\\(\\s*(?:(forward|reverse)\\s*,\\s*)?${NUM}\\s*,\\s*(seconds|sec|msec)`)))) {
          out.cmds.push({ kind: 'event', label: `${m[1]} spins ${m[3]} ${m[4]}`, seconds: m[4] === 'msec' ? Number(m[3]) / 1000 : Number(m[3]), ...at });
        } else if ((m = stmt.match(/^(\w+)\.(spin|stop|spinFor|spinToPosition)\s*\((.*)\)$/))) {
          out.cmds.push({ kind: 'event', label: `${m[1]}.${m[2]}(${m[3]})`, seconds: 0, ...at });
        } else if ((m = stmt.match(/^(\w+)\.set\s*\(\s*(true|false)\s*\)$/))) {
          out.cmds.push({ kind: 'event', label: `${m[1]} ${m[2] === 'true' ? 'extends' : 'retracts'}`, seconds: 0, ...at });
        } else if ((m = stmt.match(/^(\w+)\s*\(\s*\)$/)) && depth < 3) {
          const sub = findBody(files, m[1]);
          if (sub) walk(sub, depth + 1); else out.skipped.push(at);
        } else out.skipped.push(at);
      }
    });
  };
  walk(found, 0);
  return out;
}

export interface Pose { x: number; y: number; heading: number }
export interface SimFrame { t: number; x: number; y: number; h: number }
export interface SimResult { frames: SimFrame[]; events: { t: number; label: string; line: number }[]; total: number; segments: { t0: number; t1: number; line: number }[] }

/** Time to cover `d` at `vmax` with a 0.3 s linear ramp up and down. */
function moveTime(d: number, vmax: number, ramp = 0.3) {
  if (vmax <= 0) return 0;
  return d >= vmax * ramp ? d / vmax + ramp : 2 * Math.sqrt((d * ramp) / vmax);
}
/** Fraction of distance covered at time t of a ramped move lasting T. */
function moveFrac(t: number, T: number, d: number, vmax: number, ramp = 0.3) {
  if (T <= 0 || d <= 0) return 1;
  const tri = d < vmax * ramp;
  const r = tri ? T / 2 : ramp;
  const v = tri ? (d / r) : vmax;
  const a = v / r;
  let s: number;
  if (t <= r) s = 0.5 * a * t * t;
  else if (t <= T - r) s = 0.5 * a * r * r + v * (t - r);
  else { const td = T - t; s = d - 0.5 * a * td * td; }
  return Math.min(1, Math.max(0, s / d));
}

export function simulate(cmds: AutonCmd[], robot: { wheelRpm: number; wheelDiameterIn: number; trackWidthIn: number }, start: Pose): SimResult {
  const top = (robot.wheelRpm * Math.PI * robot.wheelDiameterIn) / 60; // in/s at 100%
  const frames: SimFrame[] = [{ t: 0, x: start.x, y: start.y, h: start.heading }];
  const events: SimResult['events'] = [];
  const segments: SimResult['segments'] = [];
  let driveVel = 50, turnVel = 50; // VEXcode defaults
  let t = 0, x = start.x, y = start.y, h = start.heading;
  const DT = 1 / 30;
  for (const c of cmds) {
    const t0 = t;
    if (c.kind === 'driveVel') driveVel = c.percent;
    else if (c.kind === 'turnVel') turnVel = c.percent;
    else if (c.kind === 'wait') { t += c.seconds; frames.push({ t, x, y, h }); }
    else if (c.kind === 'event') { events.push({ t, label: c.label, line: c.line }); if (c.seconds) { t += c.seconds; frames.push({ t, x, y, h }); } }
    else if (c.kind === 'drive') {
      const d = Math.abs(c.inches), v = top * (driveVel / 100), T = moveTime(d, v), sgn = Math.sign(c.inches);
      const x0 = x, y0 = y, rad = (h * Math.PI) / 180;
      for (let k = DT; k < T; k += DT) { const s = moveFrac(k, T, d, v) * d * sgn; frames.push({ t: t + k, x: x0 + Math.sin(rad) * s, y: y0 + Math.cos(rad) * s, h }); }
      x = x0 + Math.sin(rad) * d * sgn; y = y0 + Math.cos(rad) * d * sgn; t += T; frames.push({ t, x, y, h });
    } else {
      const target = c.kind === 'turn' ? h + c.degrees : start.heading + c.heading;
      let delta = target - h;
      if (c.kind === 'turnTo') delta = ((delta + 540) % 360) - 180;
      const arc = (Math.abs(delta) * Math.PI / 180) * (robot.trackWidthIn / 2);
      const v = top * (turnVel / 100), T = moveTime(arc, v), h0 = h;
      for (let k = DT; k < T; k += DT) frames.push({ t: t + k, x, y, h: h0 + delta * moveFrac(k, T, arc, v) });
      h = h0 + delta; t += T; frames.push({ t, x, y, h });
    }
    if (t > t0) segments.push({ t0, t1: t, line: c.line });
  }
  return { frames, events, total: t, segments };
}

export function frameAt(sim: SimResult, t: number): SimFrame {
  const f = sim.frames;
  if (t <= 0) return f[0];
  let lo = 0, hi = f.length - 1;
  if (t >= f[hi].t) return f[hi];
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (f[mid].t <= t) lo = mid; else hi = mid; }
  const a = f[lo], b = f[hi], u = (t - a.t) / Math.max(1e-6, b.t - a.t);
  return { t, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, h: a.h + (b.h - a.h) * u };
}
