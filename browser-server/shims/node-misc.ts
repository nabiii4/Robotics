// Stand-ins for the node built-ins the server code touches. The browser version has no disk and no g++:
// file reads fail like a missing file (callers already fall back), writes are dropped, child processes report ENOENT.
import { Buffer } from 'buffer';
import { zlibSync, unzlibSync, deflateSync as rawDeflate, inflateSync as rawInflate } from 'fflate';

const enoent = (p: string) => Object.assign(new Error(`ENOENT: no such file or directory, '${p}'`), { code: 'ENOENT' });

export const fs = {
  existsSync: () => false,
  mkdirSync: () => undefined,
  writeFileSync: () => undefined,
  rmSync: () => undefined,
  unlinkSync: (p: string) => { throw enoent(p); },
  readFileSync: (p: string) => { throw enoent(p); },
  readdirSync: () => [] as string[],
  statSync: (p: string) => { throw enoent(p); },
  mkdtempSync: (prefix: string) => `${prefix}browser`,
  promises: {
    readFile: async (p: string) => { throw enoent(p); },
    writeFile: async () => undefined,
    mkdir: async () => undefined,
    rm: async () => undefined,
    mkdtemp: async (prefix: string) => `${prefix}browser`,
  },
};

const norm = (parts: string[]) => {
  const out: string[] = [];
  for (const s of parts.join('/').split('/')) {
    if (!s || s === '.') continue;
    if (s === '..') out.pop(); else out.push(s);
  }
  return out;
};
export const path = {
  sep: '/',
  join: (...p: string[]) => { const abs = p[0]?.startsWith('/'); return (abs ? '/' : '') + norm(p).join('/') || '.'; },
  resolve: (...p: string[]) => { let i = p.length - 1; while (i > 0 && !p[i].startsWith('/')) i--; const rest = p.slice(i); return '/' + norm(rest[0]?.startsWith('/') ? rest : ['/app', ...rest]).join('/'); },
  dirname: (p: string) => { const i = p.replace(/\/+$/, '').lastIndexOf('/'); return i <= 0 ? (p.startsWith('/') ? '/' : '.') : p.slice(0, i); },
  basename: (p: string, ext?: string) => { const b = p.replace(/\/+$/, '').split('/').pop() ?? ''; return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
  extname: (p: string) => { const b = p.split('/').pop() ?? ''; const i = b.lastIndexOf('.'); return i > 0 ? b.slice(i) : ''; },
  relative: (_from: string, to: string) => to,
  isAbsolute: (p: string) => p.startsWith('/'),
};

export const os = { tmpdir: () => '/tmp', platform: () => 'browser', EOL: '\n' };

export const zlib = {
  deflateSync: (d: Uint8Array) => Buffer.from(zlibSync(d)),
  inflateSync: (d: Uint8Array) => Buffer.from(unzlibSync(d)),
  deflateRawSync: (d: Uint8Array) => Buffer.from(rawDeflate(d)),
  inflateRawSync: (d: Uint8Array) => Buffer.from(rawInflate(d)),
};

type Cb = (err: Error | null, stdout: string, stderr: string) => void;
export const child_process = {
  execFile: (cmd: string, _args: string[], optsOrCb: unknown, cb?: Cb) => {
    const done = (typeof optsOrCb === 'function' ? optsOrCb : cb) as Cb;
    queueMicrotask(() => done(Object.assign(new Error(`spawn ${cmd} ENOENT`), { code: 'ENOENT' }), '', ''));
    return { kill: () => undefined };
  },
};
