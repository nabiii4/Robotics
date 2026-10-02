// Builds the GitHub Pages version into docs/: a static export of the app, plus a service worker that runs the
// API routes in the browser (sql.js database saved in IndexedDB). Usage: npm run build:pages
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readMigrationFiles } from 'drizzle-orm/migrator';

const root = process.cwd();
const BASE = process.env.PAGES_BASE_PATH ?? '/Robotics';
const DEST = path.resolve(process.env.PAGES_DIR ?? 'docs');
const OUT = path.resolve('out');
const abs = (p) => path.join(root, p);

// 1. static export of the pages, from a copy of the project without the route handlers and middleware
//    (a static export can't contain them; the service worker serves /api instead)
if (!process.env.SKIP_NEXT) {
  const STAGE = abs('.pages-build');
  fs.rmSync(STAGE, { recursive: true, force: true });
  fs.mkdirSync(STAGE);
  for (const f of ['app', 'components', 'lib', 'public', 'next.config.mjs', 'tsconfig.json', 'postcss.config.mjs', 'package.json']) {
    fs.cpSync(abs(f), path.join(STAGE, f), { recursive: true, filter: (src) => src !== abs('app/api') });
  }
  fs.symlinkSync(abs('node_modules'), path.join(STAGE, 'node_modules'), 'dir');
  execSync('npx next build', { cwd: STAGE, stdio: 'inherit', env: { ...process.env, STATIC_EXPORT: '1', NEXT_PUBLIC_LOCAL_MODE: '1', NEXT_PUBLIC_BASE_PATH: BASE } });
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.renameSync(path.join(STAGE, 'out'), OUT);
  fs.rmSync(STAGE, { recursive: true, force: true });
}

// 2. routes table for the service worker, from app/api/**/route.ts
const routeFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === 'route.ts') routeFiles.push(p);
  }
})(abs('app/api'));
routeFiles.sort();
const segs = (f) => path.relative(abs('app/api'), path.dirname(f)).split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s));
const routesSrc = routeFiles.map((f, i) => `import * as r${i} from ${JSON.stringify(f)};`).join('\n')
  + `\nexport default [${routeFiles.map((f, i) => `{ segs: ${JSON.stringify(segs(f))}, mod: r${i} }`).join(',\n')}];\n`;

const migrations = readMigrationFiles({ migrationsFolder: abs('drizzle') });
const NODE_KEYS = {
  fs: ['existsSync', 'mkdirSync', 'writeFileSync', 'rmSync', 'unlinkSync', 'readFileSync', 'readdirSync', 'statSync', 'mkdtempSync', 'promises'],
  path: ['sep', 'join', 'resolve', 'dirname', 'basename', 'extname', 'relative', 'isAbsolute'],
  os: ['tmpdir', 'platform', 'EOL'],
  zlib: ['deflateSync', 'inflateSync', 'deflateRawSync', 'inflateRawSync'],
  child_process: ['execFile'],
};
const shim = (f) => ({ path: abs(`browser-server/shims/${f}`) });

const hubShims = {
  name: 'hub-shims',
  setup(b) {
    b.onResolve({ filter: /^virtual:routes$/ }, () => ({ path: 'routes', namespace: 'hub-virtual' }));
    b.onResolve({ filter: /^\.\.\/migrator\.js$/ }, (a) => (/drizzle-orm[\\/]libsql/.test(a.importer) ? { path: 'migrations', namespace: 'hub-virtual' } : undefined));
    b.onLoad({ filter: /.*/, namespace: 'hub-virtual' }, (a) => (a.path === 'routes'
      ? { contents: routesSrc, loader: 'ts', resolveDir: root }
      : { contents: `const M = ${JSON.stringify(migrations)};\nexport function readMigrationFiles() { return M; }`, loader: 'js' }));
    b.onResolve({ filter: /^(node:)?(fs|path|os|zlib|child_process)$/ }, (a) => ({ path: a.path.replace(/^node:/, ''), namespace: 'hub-node' }));
    b.onLoad({ filter: /.*/, namespace: 'hub-node' }, (a) => ({
      contents: `import { ${a.path} as m } from ${JSON.stringify(abs('browser-server/shims/node-misc.ts'))};\nexport default m;\n${NODE_KEYS[a.path].map((k) => `export const ${k} = m.${k};`).join('\n')}`,
      loader: 'js', resolveDir: root,
    }));
    b.onResolve({ filter: /^(node:)?crypto$/ }, () => shim('crypto.ts'));
    b.onResolve({ filter: /^(server-only|node:module|module)$/ }, () => ({ path: 'empty', namespace: 'hub-empty' }));
    b.onLoad({ filter: /.*/, namespace: 'hub-empty' }, () => ({ contents: 'export default {}; export const createRequire = () => () => ({});', loader: 'js' }));
    b.onResolve({ filter: /^next\/server$/ }, () => shim('next-server.ts'));
    b.onResolve({ filter: /^next\/headers$/ }, () => shim('next-headers.ts'));
    b.onResolve({ filter: /^@libsql\/client$/ }, () => shim('libsql.ts'));
  },
};

const env = {
  NODE_ENV: 'production', AI_MOCK: '1', SEED_SCENARIO: 'B', DATABASE_URL: 'browser:indexeddb',
  ADMIN_USERNAME: 'coach', ADMIN_INITIAL_PASSWORD: 'cougars-hub', BCRYPT_COST: '8',
};
const banner = `var process = globalThis.process = { env: Object.assign(${JSON.stringify(env)}, { APP_URL: self.location.origin }), versions: {}, browser: true, platform: 'browser', cwd: function () { return '/app'; }, nextTick: function (f) { var a = [].slice.call(arguments, 1); queueMicrotask(function () { f.apply(null, a); }); }, emitWarning: function () {} };
var __swUrl = self.location.href;`;

await build({
  entryPoints: [abs('browser-server/sw.ts')],
  outfile: path.join(OUT, 'sw.js'),
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true, legalComments: 'none',
  tsconfig: abs('tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.url': '__swUrl' },
  inject: [abs('browser-server/shims/buffer-inject.ts')],
  banner: { js: banner },
  plugins: [hubShims],
  logLevel: 'warning',
});

// 3. WebAssembly the worker loads at runtime
fs.copyFileSync(abs('node_modules/sql.js/dist/sql-wasm-browser.wasm'), path.join(OUT, 'sql-wasm-browser.wasm'));
fs.copyFileSync(abs('node_modules/manifold-3d/manifold.wasm'), path.join(OUT, 'manifold.wasm'));

// 4. GitHub Pages extras: keep _next/ (no Jekyll), and send unknown deep links through the worker
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, '404.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FDRHS Robotics Hub</title></head>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#3b4148">
<p id="m">Opening FDRHS Robotics Hub…</p>
<script>
(function () {
  var base = ${JSON.stringify(BASE)};
  var home = function () { location.replace(base + '/'); };
  var last = Number(sessionStorage.getItem('hub-404') || 0);
  if (!('serviceWorker' in navigator) || Date.now() - last < 10000) return home();
  sessionStorage.setItem('hub-404', String(Date.now()));
  navigator.serviceWorker.register(base + '/sw.js', { scope: base + '/' }).then(function () { return navigator.serviceWorker.ready; }).then(function () { location.reload(); }, home);
})();
</script></body></html>
`);

fs.rmSync(DEST, { recursive: true, force: true });
fs.cpSync(OUT, DEST, { recursive: true });
console.log(`\nGitHub Pages site written to ${path.relative(root, DEST)}/ (base path ${BASE}).`);
