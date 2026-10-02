import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const r = await db.query.settingsKv.findFirst({ where: eq(schema.settingsKv.key, key) });
  return (r?.value as T) ?? fallback;
}
export async function setSetting(key: string, value: unknown) {
  await db.insert(schema.settingsKv).values({ key, value }).onConflictDoUpdate({ target: schema.settingsKv.key, set: { value } });
}
