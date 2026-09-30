import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { hashPassword, passwordProblems, verifyPassword } from '@/lib/auth/password';

export const runtime = 'nodejs';
const Body = z.object({ current: z.string().min(1), next: z.string().min(10).max(200) });
export const POST = route({ body: Body }, async ({ user, body }) => {
  if (!(await verifyPassword(body.current, user.passwordHash))) throw bad('Your current password is not right.');
  const p = passwordProblems(body.next);
  if (p) throw bad(p);
  await db.update(schema.users).set({ passwordHash: await hashPassword(body.next), mustChangePassword: false }).where(eq(schema.users.id, user.id));
  return { ok: true };
});
