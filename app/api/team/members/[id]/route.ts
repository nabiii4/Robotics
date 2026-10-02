import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

const Body = z.object({
  role: z.enum(['admin', 'captain', 'member']).optional(),
  teamRole: z.enum(['Builder', 'Programmer', 'Driver', 'Designer', 'Notebook', 'Captain', 'Coach']).optional(),
  disabled: z.boolean().optional(),
});

export const PATCH = route<{ id: string }, typeof Body>({ role: 'admin', body: Body }, async ({ params, body, user }) => {
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, params.id) });
  if (!u) throw notFound('That member no longer exists.');
  if (u.id === user.id && (body.role && body.role !== 'admin' || body.disabled)) throw bad('You can’t demote or deactivate yourself.');
  if (u.role === 'admin' && (body.role && body.role !== 'admin' || body.disabled)) {
    const admins = await db.select({ id: schema.users.id }).from(schema.users).where(and(eq(schema.users.role, 'admin'), eq(schema.users.disabled, false)));
    if (admins.length <= 1) throw bad('The team needs at least one admin.');
  }
  await db.update(schema.users).set(body).where(eq(schema.users.id, u.id));
  if (body.disabled) await db.delete(schema.sessions).where(eq(schema.sessions.userId, u.id));
  return { ok: true };
});
