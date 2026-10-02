// Pure checks shared by the server compile and the fallback checker (no Node APIs here).
export interface Diag { file: string; line: number; col: number; severity: 'error' | 'warning' | 'note'; message: string }
export interface ProjectFile { path: string; content: string }

export const ALLOWED_SYSTEM = new Set([
  'cmath', 'math.h', 'cstdio', 'stdio.h', 'cstdlib', 'stdlib.h', 'cstring', 'string.h', 'string', 'vector', 'array', 'algorithm', 'functional', 'utility', 'cstdint', 'stdint.h', 'sstream',
]);
const STUBS = new Set(['v5.h', 'v5_vcs.h']);
export const MAX_FILE = 200 * 1024;
export const MAX_TOTAL = 1024 * 1024;

const lineOf = (src: string, idx: number) => src.slice(0, idx).split('\n').length;

/** Include policy (spec §18.5) — anything that fails is an error and the compiler is not run. */
export function includePolicy(files: ProjectFile[]): Diag[] {
  const out: Diag[] = [];
  const paths = new Set(files.map((f) => f.path));
  let total = 0;
  for (const f of files) {
    total += f.content.length;
    if (f.content.length > MAX_FILE) out.push({ file: f.path, line: 1, col: 1, severity: 'error', message: 'File is over 200 KB.' });
    if (/(^|\/)\.\.(\/|$)/.test(f.path) || f.path.startsWith('/')) out.push({ file: f.path, line: 1, col: 1, severity: 'error', message: 'Invalid file path.' });
    const lines = f.content.split('\n');
    lines.forEach((l, i) => {
      if (/#\s*include_next\b/.test(l)) out.push({ file: f.path, line: i + 1, col: 1, severity: 'error', message: '#include_next is not allowed.' });
      if (/__has_include/.test(l)) out.push({ file: f.path, line: i + 1, col: 1, severity: 'error', message: '__has_include is not allowed.' });
      const m = l.match(/^\s*#\s*include\s*([<"])([^>"]*)[>"]/);
      if (!m) return;
      const [, kind, target] = m;
      if (target.startsWith('/') || target.includes('..') || target.includes('\\')) { out.push({ file: f.path, line: i + 1, col: 1, severity: 'error', message: `Include path "${target}" is not allowed.` }); return; }
      if (kind === '<') {
        if (!ALLOWED_SYSTEM.has(target) && !STUBS.has(target)) out.push({ file: f.path, line: i + 1, col: 1, severity: 'error', message: `<${target}> isn't available on the V5 Brain here. Allowed: ${[...ALLOWED_SYSTEM].join(', ')}.` });
      } else if (!STUBS.has(target)) {
        const candidates = [target, `include/${target}`, `src/${target}`, `${f.path.split('/').slice(0, -1).join('/')}/${target}`.replace(/^\//, '')];
        if (!candidates.some((c) => paths.has(c))) out.push({ file: f.path, line: i + 1, col: 1, severity: 'error', message: `"${target}" was not found in this project.` });
      }
    });
  }
  if (total > MAX_TOTAL) out.push({ file: files[0]?.path ?? 'project', line: 1, col: 1, severity: 'error', message: 'Project is over 1 MB.' });
  return out;
}

/** Strip comments and string contents (keeping line structure) so brace/keyword scans aren't fooled. */
export function stripCode(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && n === '*') { out += '  '; i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; continue; }
    if (c === '"' || c === "'") {
      const q = c; out += q; i++;
      while (i < src.length && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { out += ' '; i++; } out += ' '; i++; }
      out += src[i] ?? ''; i++; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Fallback syntax check when g++ isn't installed: brackets, strings, statements. */
export function syntaxCheck(f: ProjectFile): Diag[] {
  const out: Diag[] = [];
  const src = f.content;
  // unterminated strings / comments
  const lines = src.split('\n');
  let inBlock = false;
  lines.forEach((l, i) => {
    let j = 0;
    while (j < l.length) {
      if (inBlock) { const e = l.indexOf('*/', j); if (e < 0) { j = l.length; break; } inBlock = false; j = e + 2; continue; }
      if (l.startsWith('//', j)) break;
      if (l.startsWith('/*', j)) { inBlock = true; j += 2; continue; }
      if (l[j] === '"' || l[j] === "'") {
        const q = l[j]; let k = j + 1;
        while (k < l.length && l[k] !== q) k += l[k] === '\\' ? 2 : 1;
        if (k >= l.length && !l.trimEnd().endsWith('\\')) { out.push({ file: f.path, line: i + 1, col: j + 1, severity: 'error', message: `missing terminating ${q} character` }); break; }
        j = k + 1; continue;
      }
      j++;
    }
  });
  if (inBlock) out.push({ file: f.path, line: lines.length, col: 1, severity: 'error', message: 'unterminated comment' });
  const code = stripCode(src);
  const stack: { ch: string; idx: number }[] = [];
  const pair: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === '(' || c === '[' || c === '{') stack.push({ ch: c, idx: i });
    else if (c in pair) {
      const top = stack.pop();
      if (!top || top.ch !== pair[c]) { out.push({ file: f.path, line: lineOf(code, i), col: i - code.lastIndexOf('\n', i - 1), severity: 'error', message: `expected ${top ? `'${{ '(': ')', '[': ']', '{': '}' }[top.ch]}'` : 'declaration'} before '${c}' token` }); if (top) stack.push(top); }
    }
  }
  for (const s of stack) out.push({ file: f.path, line: lineOf(code, s.idx), col: s.idx - code.lastIndexOf('\n', s.idx - 1), severity: 'error', message: `'${s.ch}' was never closed` });
  // statements missing a semicolon: a line ending in ")" followed by a line that starts a new statement
  const cl = code.split('\n');
  for (let i = 0; i < cl.length - 1; i++) {
    const a = cl[i].trim();
    if (!a || a.startsWith('#')) continue;
    if (/\)\s*$/.test(a) && !/^(if|else|for|while|switch|do)\b|\b(if|for|while|switch)\s*\(/.test(a) && !/^[\w:<>,\s*&]+\s+[\w:]+\s*\(.*\)\s*(const)?\s*$/.test(a)) {
      let k = i + 1; while (k < cl.length && !cl[k].trim()) k++;
      const b = (cl[k] ?? '').trim();
      if (b && !b.startsWith('{') && !b.startsWith('.') && !b.startsWith('&&') && !b.startsWith('||') && !b.startsWith(':') && !b.startsWith('?') && !b.startsWith('+') && !b.startsWith('<<') && !b.startsWith(',') && !b.startsWith(')')) {
        out.push({ file: f.path, line: i + 1, col: cl[i].length + 1, severity: 'error', message: "expected ';' at end of statement" });
      }
    }
  }
  return out;
}

const VEX_KNOWN = new Set(['Brain', 'Controller1', 'Controller2', 'Competition', 'vex', 'std', 'wait', 'vexcodeInit', 'printf', 'main', 'this_thread', 'task', 'thread', 'timer']);
const UNITS: Record<string, string[]> = {
  driveFor: ['inches', 'mm', 'cm', 'turns', 'degrees', 'rev'], turnFor: ['degrees', 'turns', 'rev'], turnToHeading: ['degrees'], wait: ['msec', 'seconds', 'sec'], spinFor: ['degrees', 'turns', 'rev', 'seconds', 'msec', 'sec'],
};

/** VEX-specific lint rules (spec §18.5 fallback). `devices` are the names from robot-config. */
export function vexLint(files: ProjectFile[], devices: string[]): Diag[] {
  const out: Diag[] = [];
  const known = new Set([...devices, ...VEX_KNOWN]);
  // identifiers declared in the project (functions, variables)
  const all = files.map((f) => stripCode(f.content)).join('\n');
  for (const m of all.matchAll(/\b(?:void|int|double|float|bool|auto|char|long|motor|motor_group|digital_out|inertial|rotation|optical|distance|drivetrain|smartdrive|controller|brain|competition|const\s+\w+|std::\w+)\s+(\w+)/g)) known.add(m[1]);
  for (const f of files) {
    if (!/\.(cpp|h|hpp)$/.test(f.path)) continue;
    const code = stripCode(f.content);
    const lines = code.split('\n');
    lines.forEach((l, i) => {
      // obj.method( where obj is unknown → probably a typo'd device name
      for (const m of l.matchAll(/\b([A-Za-z_]\w*)\s*\.\s*(spin|stop|spinFor|spinToPosition|driveFor|turnFor|turnToHeading|setVelocity|setDriveVelocity|setTurnVelocity|set|setStopping|position|value|pressing|velocity)\s*\(/g)) {
        if (!known.has(m[1]) && !/^Button|^Axis/.test(m[1])) out.push({ file: f.path, line: i + 1, col: (m.index ?? 0) + 1, severity: 'error', message: `'${m[1]}' was not declared in this scope — check the device name in robot-config.h` });
      }
      for (const [fn, ok] of Object.entries(UNITS)) {
        const re = new RegExp(`\\b${fn}\\s*\\(([^;]*)\\)`, 'g');
        for (const m of l.matchAll(re)) {
          const args = m[1].split(',').map((s) => s.trim());
          const unit = args[args.length - 1];
          if (/^[a-z]+$/.test(unit) && !ok.includes(unit) && !['forward', 'reverse', 'left', 'right', 'percent', 'rpm', 'dps', 'true', 'false'].includes(unit)) out.push({ file: f.path, line: i + 1, col: (m.index ?? 0) + 1, severity: 'error', message: `'${unit}' isn't a valid unit for ${fn}() — use ${ok.join(', ')}` });
        }
      }
    });
    // while(true) loops with no wait
    for (const m of code.matchAll(/while\s*\(\s*(true|1)\s*\)\s*\{/g)) {
      const start = (m.index ?? 0) + m[0].length;
      let depth = 1, k = start;
      while (k < code.length && depth > 0) { if (code[k] === '{') depth++; else if (code[k] === '}') depth--; k++; }
      const body = code.slice(start, k - 1);
      if (!/\bwait\s*\(|this_thread::sleep_for|task::sleep/.test(body)) out.push({ file: f.path, line: lineOf(code, m.index ?? 0), col: 1, severity: 'warning', message: 'while (true) loop has no wait(…) — it will starve other tasks; add wait(20, msec);' });
      // driver control: spin with no stop branch
      if (/\.spin\s*\(/.test(body) && /pressing\s*\(/.test(body) && !/\.stop\s*\(|setVelocity\s*\(\s*0|spin\s*\([^)]*,\s*0\s*,/.test(body)) out.push({ file: f.path, line: lineOf(code, m.index ?? 0), col: 1, severity: 'warning', message: 'A motor is spun in this loop but never stopped — add an else branch that calls .stop()' });
    }
    // duplicate ports in robot-config
    if (f.path.endsWith('robot-config.cpp')) {
      const ports = new Map<string, number>();
      lines.forEach((l, i) => { for (const m of l.matchAll(/\bPORT(\d+)\b/g)) { if (ports.has(m[1])) out.push({ file: f.path, line: i + 1, col: 1, severity: 'error', message: `PORT${m[1]} is used twice (also on line ${ports.get(m[1])})` }); else ports.set(m[1], i + 1); } });
    }
  }
  return out;
}

export function parseGccOutput(text: string, root: string): Diag[] {
  const out: Diag[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^(.+?):(\d+):(\d+):\s+(fatal error|error|warning|note):\s+(.*)$/);
    if (!m) continue;
    const file = m[1].replace(root, '').replace(/^[/\\]+/, '');
    if (file.startsWith('vex_stub')) continue;
    out.push({ file, line: Number(m[2]), col: Number(m[3]), severity: m[4] === 'fatal error' ? 'error' : (m[4] as Diag['severity']), message: m[5] });
  }
  return out;
}
