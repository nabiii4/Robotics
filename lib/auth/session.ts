import 'server-only';
import { cookies, headers } from 'next/headers';
import { and, eq, gt } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { randomToken, sha256 } from '../crypto';

export const COOKIE = 'fdr_session';
const DAY = 24 * 3600 * 1000;

export type SessionUser = typeof schema.users.$inferSelect;

export async function createSession(userId: string, keep: boolean) {
  const token = randomToken(32);
  const now = Date.now();
  const expires = new Date(now + (keep ? 30 * DAY : 12 * 3600 * 1000));
  const ua = (await headers()).get('user-agent')?.slice(0, 200) ?? null;
  await db.insert(schema.sessions).values({ id: newId(), userId, tokenHash: sha256(token), createdAt: new Date(now), expiresAt: expires, keepSignedIn: keep, userAgent: ua });
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && process.env.APP_URL?.startsWith('https'), path: '/', expires });
}

export async function currentSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const hash = sha256(token);
  const row = await db.select().from(schema.sessions).innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.tokenHash, hash), gt(schema.sessions.expiresAt, new Date()))).limit(1);
  const r = row[0];
  if (!r || r.users.disabled) return null;
  const now = Date.now();
  // sliding renewal for "keep me signed in"
  if (r.sessions.keepSignedIn && r.sessions.expiresAt.getTime() - now < 15 * DAY) {
    await db.update(schema.sessions).set({ expiresAt: new Date(now + 30 * DAY) }).where(eq(schema.sessions.id, r.sessions.id));
  }
  if (!r.users.lastActiveAt || now - r.users.lastActiveAt.getTime() > 60_000) {
    await db.update(schema.users).set({ lastActiveAt: new Date(now) }).where(eq(schema.users.id, r.users.id));
  }
  return { session: r.sessions, user: r.users };
}

export async function currentUser(): Promise<SessionUser | null> {
  return (await currentSession())?.user ?? null;
}

export async function destroySession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)));
  (await cookies()).delete(COOKIE);
}
