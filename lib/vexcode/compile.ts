import 'server-only';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { V5_H, V5_VCS_H } from './stub';
import { includePolicy, parseGccOutput, syntaxCheck, vexLint, type Diag, type ProjectFile } from './check';

let gxxOk: boolean | null = null;
function run(cmd: string, args: string[], cwd: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd, timeout: 10_000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH ?? '/usr/bin:/bin', LANG: 'C' } as unknown as NodeJS.ProcessEnv, encoding: 'utf8' }, (err: Error | null, stdout: string, stderr: string) => {
      const c = (err as { code?: unknown } | null)?.code;
      const code = !err ? 0 : typeof c === 'number' ? c : c === 'ENOENT' ? -2 : 1;
      resolve({ code, out: `${stdout}\n${stderr}` });
    });
  });
}

async function hasGxx(gxx: string) {
  if (gxxOk !== null) return gxxOk;
  const r = await run(gxx, ['--version'], os.tmpdir());
  gxxOk = r.code === 0;
  return gxxOk;
}

export interface CompileResult { ok: boolean; engine: string; diagnostics: Diag[]; log: string }

/** Compile = g++ -fsyntax-only against the V5 stub headers (spec §18.5); falls back to the JS checker. */
export async function compileProject(files: ProjectFile[], devices: string[], gxx = process.env.GXX_PATH || 'g++'): Promise<CompileResult> {
  const code = files.filter((f) => /\.(cpp|h|hpp|c)$/.test(f.path));
  const policy = includePolicy(code);
  if (policy.length) return { ok: false, engine: 'include policy', diagnostics: policy, log: policy.map((d) => `${d.file}:${d.line}: ${d.message}`).join('\n') };
  const lint = vexLint(code, devices).filter((d) => d.severity === 'warning');
  if (!(await hasGxx(gxx))) {
    const diags = [...code.flatMap(syntaxCheck), ...vexLint(code, devices)];
    return { ok: !diags.some((d) => d.severity === 'error'), engine: 'Checked (syntax + VEX rules)', diagnostics: diags, log: 'g++ isn’t available here — ran the built-in checker instead.\n' + diags.map((d) => `${d.file}:${d.line}:${d.col}: ${d.severity}: ${d.message}`).join('\n') };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdrhs-vex-'));
  try {
    fs.mkdirSync(path.join(dir, 'vex_stub'));
    fs.writeFileSync(path.join(dir, 'vex_stub', 'v5.h'), V5_H);
    fs.writeFileSync(path.join(dir, 'vex_stub', 'v5_vcs.h'), V5_VCS_H);
    for (const f of code) {
      const p = path.join(dir, f.path);
      if (!p.startsWith(dir + path.sep)) continue;
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, f.content);
    }
    const srcs = code.filter((f) => /\.(cpp|c)$/.test(f.path)).map((f) => f.path);
    if (!srcs.length) return { ok: true, engine: 'Compiled (g++ syntax check)', diagnostics: [], log: 'No source files.' };
    const r = await run(gxx, ['-std=gnu++17', '-fsyntax-only', '-Wall', '-Wextra', '-Wno-unused-parameter', '-Iinclude', '-Ivex_stub', ...srcs], dir);
    const diags = parseGccOutput(r.out, dir);
    // add VEX-specific warnings g++ can't see (deduped by line)
    for (const w of lint) if (!diags.some((d) => d.file === w.file && d.line === w.line)) diags.push(w);
    return { ok: !diags.some((d) => d.severity === 'error'), engine: 'Compiled (g++ syntax check)', diagnostics: diags, log: r.out.replaceAll(dir + path.sep, '').trim() || 'g++: no output (clean).' };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
