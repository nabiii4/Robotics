import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { hashPassword } from '@/lib/auth/password';

export const runtime = 'nodejs';

/** Admin resets a member's password: returns a one-time temporary password; they must change it at next sign-in. */
export const POST = route<{ id: string }>({ role: 'admin' }, async ({ params }) => {
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, params.id) });
  if (!u) throw notFound('That member no longer exists.');
  const temp = crypto.randomBytes(9).toString('base64url').slice(0, 12);
  await db.update(schema.users).set({ passwordHash: await hashPassword(temp), mustChangePassword: true }).where(eq(schema.users.id, u.id));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
  return { temporaryPassword: temp };
});
