import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';
import { env } from '../env';

type DB = LibSQLDatabase<typeof schema>;
const g = globalThis as unknown as { __fdrDb?: DB; __fdrClient?: Client };

export function getClient(): Client {
  if (!g.__fdrClient) {
    const url = env().DATABASE_URL;
    if (url.startsWith('file:')) {
      const file = url.slice(5);
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    }
    g.__fdrClient = createClient({ url, authToken: env().DATABASE_AUTH_TOKEN || undefined });
  }
  return g.__fdrClient;
}

export function getDb(): DB {
  if (!g.__fdrDb) g.__fdrDb = drizzle(getClient(), { schema });
  return g.__fdrDb;
}

export const db = new Proxy({} as DB, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const val = real[prop];
    return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(real) : val;
  },
});
export { schema };
