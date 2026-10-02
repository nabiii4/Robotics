// Opens the browser database (sql.js), applies migrations, seeds a first-time visitor, and saves changes to IndexedDB.
import initSqlJs, { type Database } from 'sql.js';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { getDb, schema } from '@/lib/db/client';
import { kvGet, kvSet } from './idb';
import { loadCookies } from './shims/next-headers';

const g = globalThis as unknown as { __sqljsDb?: Database; __sqljsDirty?: boolean; __fdrSnapshot?: () => Uint8Array };
let ready: Promise<void> | null = null;

async function open(base: string) {
  const SQL = await initSqlJs({ locateFile: (f: string) => `${base}/${f}` });
  const saved = (await kvGet('db')) as Uint8Array | undefined;
  g.__sqljsDb = saved ? new SQL.Database(saved) : new SQL.Database();
  await loadCookies();
  await migrate(getDb(), { migrationsFolder: 'embedded' });
  const existing = await getDb().select({ id: schema.users.id }).from(schema.users).limit(1);
  if (!existing.length) {
    const { seed } = await import('@/lib/seed');
    await seed('B', () => undefined);
  }
  g.__fdrSnapshot = () => g.__sqljsDb!.export();
  await save(true);
}

export function ensureReady(base: string) {
  if (!ready) ready = open(base).catch((e) => { ready = null; throw e; });
  return ready;
}

let saving: Promise<void> = Promise.resolve();
/** Write the database to IndexedDB if anything changed (chained, so saves never overlap). */
export function save(force = false) {
  saving = saving.then(async () => {
    if (!g.__sqljsDb || (!force && !g.__sqljsDirty)) return;
    g.__sqljsDirty = false;
    await kvSet('db', g.__sqljsDb.export());
  }).catch((e) => { g.__sqljsDirty = true; console.error('[hub] save failed', e); });
  return saving;
}

/** Wipe this browser's copy and start again with the demo team. */
export async function resetAll() {
  await kvSet('db', undefined);
  await kvSet('cookies', {});
  g.__sqljsDb?.close();
  g.__sqljsDb = undefined;
  ready = null;
}
