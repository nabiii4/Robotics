import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';

/** DB-backed fixed-window limiter (works on serverless). Returns remaining count, or -1 when blocked. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();
  const row = await db.query.rateLimits.findFirst({ where: eq(schema.rateLimits.key, key) });
  if (!row || now - row.windowStart >= windowMs) {
    await db.insert(schema.rateLimits).values({ key, windowStart: now, count: 1 }).onConflictDoUpdate({ target: schema.rateLimits.key, set: { windowStart: now, count: 1 } });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (row.count >= limit) return { ok: false, remaining: 0, resetAt: row.windowStart + windowMs };
  await db.update(schema.rateLimits).set({ count: row.count + 1 }).where(eq(schema.rateLimits.key, key));
  return { ok: true, remaining: limit - row.count - 1, resetAt: row.windowStart + windowMs };
}
