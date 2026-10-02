import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, ApiError, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { hashPassword, passwordProblems } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { rateLimit } from '@/lib/auth/rateLimit';
import { sha256 } from '@/lib/crypto';
import { newId } from '@/lib/ids';
import { logActivity, notifyRoles } from '@/lib/services/activity';

export const runtime = 'nodejs';
const COLORS = ['#1B67C6', '#C11A0E', '#1C9E4B', '#643DBC', '#EA8111', '#0E7490', '#C2185B'];
const Body = z.object({
  code: z.string().min(1).max(40), displayName: z.string().trim().min(1).max(40), username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_.-]+$/, 'letters, numbers, . _ - only'),
  password: z.string().min(10).max(200), teamRole: z.enum(['Builder', 'Programmer', 'Driver', 'Designer', 'Notebook', 'Captain']).default('Builder'), grade: z.string().max(10).optional().nullable(),
});

export const POST = route({ auth: false, body: Body }, async ({ req, body }) => {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const rl = await rateLimit(`join:${sha256(ip).slice(0, 12)}`, 10, 3_600_000);
  if (!rl.ok) throw new ApiError(429, 'rate_limited', 'Too many join attempts from this network. Try again later.');
  const team = await db.query.team.findFirst();
  if (!team || team.joinCodeHash !== sha256(body.code.trim().toUpperCase())) throw bad('That join code isn’t right. Ask your coach for the current code.');
  const problem = passwordProblems(body.password);
  if (problem) throw bad(problem);
  const username = body.username.toLowerCase();
  if (await db.query.users.findFirst({ where: eq(schema.users.username, username) })) throw bad('That username is taken.');
  const count = (await db.select({ id: schema.users.id }).from(schema.users)).length;
  const id = newId();
  await db.insert(schema.users).values({
    id, username, displayName: body.displayName, avatarColor: COLORS[count % COLORS.length], role: 'member', teamRole: body.teamRole, grade: body.grade || null,
    passwordHash: await hashPassword(body.password), prefs: { layout: 'b', memoryEnabled: true, replyLength: 'concise', quality: 'medium' }, createdAt: new Date(), lastActiveAt: new Date(),
  });
  await logActivity({ type: 'member.joined', actorId: id, entityType: 'user', entityId: id });
  await notifyRoles(['admin'], { type: 'team.joined', title: `${body.displayName} joined the team`, body: `Team role: ${body.teamRole}`, link: '/team' });
  await createSession(id, false);
  return { ok: true };
});
