// Service worker for the GitHub Pages version: it answers /api/* with the app's own route handlers
// (running in the browser against sql.js), and maps dynamic page URLs onto the exported placeholder pages.
import routes from 'virtual:routes';
import { NextRequest } from './shims/next-server';
import { setRequestHeaders } from './shims/next-headers';
import { ensureReady, save, resetAll } from './store';

interface FetchEvt extends Event { request: Request; respondWith(r: Promise<Response> | Response): void; waitUntil(p: Promise<unknown>): void }
interface ExtEvt extends Event { waitUntil(p: Promise<unknown>): void }
const sw = self as unknown as {
  location: Location; registration: { scope: string };
  skipWaiting(): Promise<void>; clients: { claim(): Promise<void> };
  addEventListener(t: 'fetch', fn: (e: FetchEvt) => void): void;
  addEventListener(t: 'install' | 'activate', fn: (e: ExtEvt) => void): void;
  addEventListener(t: 'message', fn: (e: MessageEvent) => void): void;
};

const BASE = new URL(sw.registration.scope).pathname.replace(/\/$/, '');
// dynamic routes are exported once with "_" as the id
const DYNAMIC_PAGES = /^\/(builds|competitions|uploads)\/([^/.]+)(\/[^/]*)?\/?$/;

sw.addEventListener('install', (e) => { e.waitUntil(sw.skipWaiting()); });
sw.addEventListener('activate', (e) => { e.waitUntil(sw.clients.claim()); });
// a page loaded with a hard refresh asks the worker to take over
sw.addEventListener('message', (e) => { if (e.data === 'claim') void sw.clients.claim(); });

sw.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== sw.location.origin) return;
  let p = url.pathname;
  if (p.startsWith(`${BASE}/api/`)) p = p.slice(BASE.length);
  if (p.startsWith('/api/')) { e.respondWith(handleApi(e, p, url)); return; }
  if (!p.startsWith(`${BASE}/`)) {
    // root-relative assets referenced without the base path
    if (p.startsWith('/brand/')) e.respondWith(fetch(`${BASE}${p}`));
    return;
  }
  const m = p.slice(BASE.length).match(DYNAMIC_PAGES);
  if (m && m[2] !== '_') {
    // page HTML → the placeholder's index.html; router payloads (index.txt) → the placeholder's payload
    const file = m[3] && m[3].includes('.') ? m[3] : '/';
    e.respondWith(fetch(`${BASE}/${m[1]}/_${file}${file === '/' ? '' : url.search}`));
    return;
  }
  if (e.request.mode === 'navigate') e.respondWith(navigate(e.request));
});

// unknown deep links fall back to the dashboard instead of GitHub's 404 page
async function navigate(req: Request) {
  const r = await fetch(req);
  if (r.status !== 404) return r;
  const home = await fetch(`${BASE}/`);
  return home.ok ? home : r;
}

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string | string[]>> }) => Promise<Response>;

function match(path: string) {
  const parts = path.split('/').filter(Boolean).slice(1); // drop "api"
  let best: { mod: Record<string, Handler>; params: Record<string, string | string[]>; score: number } | null = null;
  for (const r of routes) {
    const params: Record<string, string | string[]> = {};
    let score = 0, ok = true, i = 0;
    for (const seg of r.segs) {
      if (seg.startsWith('[[...')) { params[seg.slice(5, -2)] = parts.slice(i).map(decodeURIComponent); i = parts.length; break; }
      if (seg.startsWith('[...')) { if (i >= parts.length) { ok = false; break; } params[seg.slice(4, -1)] = parts.slice(i).map(decodeURIComponent); i = parts.length; break; }
      if (i >= parts.length) { ok = false; break; }
      if (seg.startsWith('[')) { params[seg.slice(1, -1)] = decodeURIComponent(parts[i]); score += 1; }
      else if (seg === parts[i]) score += 3;
      else { ok = false; break; }
      i++;
    }
    if (!ok || i !== parts.length) continue;
    if (!best || score > best.score) best = { mod: r.mod as Record<string, Handler>, params, score };
  }
  return best;
}

const json = (status: number, message: string) => new Response(JSON.stringify({ error: { code: status === 404 ? 'not_found' : 'server_error', message } }), { status, headers: { 'content-type': 'application/json' } });

async function handleApi(e: FetchEvt, path: string, url: URL): Promise<Response> {
  try {
    await ensureReady(BASE);
    if (path === '/api/local/reset' && e.request.method === 'POST') {
      await resetAll();
      await ensureReady(BASE);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
    }
    const found = match(path);
    if (!found) return json(404, 'Not found');
    const method = e.request.method === 'HEAD' ? 'GET' : e.request.method;
    const fn = found.mod[method];
    if (typeof fn !== 'function') return json(405, 'Method not allowed');
    const headers = new Headers(e.request.headers);
    headers.set('host', sw.location.host);
    headers.set('origin', sw.location.origin);
    headers.set('x-forwarded-proto', sw.location.protocol.replace(':', ''));
    const hasBody = method !== 'GET' && method !== 'HEAD';
    const req = new NextRequest(`${sw.location.origin}${path}${url.search}`, { method, headers, body: hasBody ? await e.request.arrayBuffer() : undefined });
    setRequestHeaders(headers);
    const res = await fn(req, { params: Promise.resolve(found.params) });
    e.waitUntil(save());
    return res;
  } catch (err) {
    console.error('[hub]', path, err);
    return json(500, `The browser server hit an error: ${(err as Error).message}`);
  }
}
