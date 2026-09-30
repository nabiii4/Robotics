import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, ApiError } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rateLimit';
import { sha256 } from '@/lib/crypto';

export const runtime = 'nodejs';
const Body = z.object({ username: z.string().min(1).max(40), password: z.string().min(1).max(200), keep: z.boolean().default(false) });

export const POST = route({ auth: false, body: Body }, async ({ req, body }) => {
  const username = body.username.trim().toLowerCase();
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const rl = await rateLimit(`login:${username}:${sha256(ip).slice(0, 12)}`, 5, 60_000);
  if (!rl.ok) throw new ApiError(429, 'rate_limited', 'Too many sign-in attempts. Wait a minute and try again.');
  const user = await db.query.users.findFirst({ where: eq(schema.users.username, username) });
  if (!user || user.disabled || !(await verifyPassword(body.password, user.passwordHash))) throw new ApiError(401, 'bad_credentials', 'That username and password don’t match.');
  await createSession(user.id, body.keep);
  return { ok: true, mustChangePassword: user.mustChangePassword };
});
