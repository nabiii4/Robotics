// next/headers for the in-browser server. The browser ignores Set-Cookie on service-worker responses,
// so cookies live in a jar that's saved to IndexedDB with the database.
import { kvGet, kvSet } from '../idb';

interface Saved { value: string; expires: number | null }
let jar: Record<string, Saved> = {};
let current = new Headers();

export async function loadCookies() {
  jar = ((await kvGet('cookies')) as Record<string, Saved> | undefined) ?? {};
}
const persist = () => kvSet('cookies', jar);
export const setRequestHeaders = (h: Headers) => { current = h; };

const live = (name: string) => {
  const c = jar[name];
  if (c && c.expires !== null && c.expires < Date.now()) { delete jar[name]; void persist(); return undefined; }
  return c;
};

const cookieStore = {
  get(name: string) { const c = live(name); return c ? { name, value: c.value } : undefined; },
  has(name: string) { return !!live(name); },
  getAll() { return Object.keys(jar).filter((n) => live(n)).map((name) => ({ name, value: jar[name].value })); },
  set(name: string, value: string, opts?: { expires?: Date | number; maxAge?: number }) {
    const expires = opts?.maxAge !== undefined ? Date.now() + opts.maxAge * 1000 : opts?.expires !== undefined ? new Date(opts.expires).getTime() : null;
    jar[name] = { value, expires };
    void persist();
    return cookieStore;
  },
  delete(name: string) { delete jar[name]; void persist(); return cookieStore; },
};

export async function cookies() { return cookieStore; }
export async function headers() { return current; }
