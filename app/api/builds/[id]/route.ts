import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound, forbidden, atLeast } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { buildWithVersions } from '@/lib/services/buildList';
import { canEditBuild } from '@/lib/services/builds';
import { logActivity } from '@/lib/services/activity';

export const runtime = 'nodejs';
type P = { id: string };

export const GET = route<P>({}, async ({ user, params }) => {
  const b = await canEditBuild(params.id, user);
  if (!b) throw notFound('Build not found');
  return buildWithVersions(params.id);
});

const Body = z.object({
  name: z.string().trim().min(1).max(60).optional(), tagline: z.string().trim().max(80).nullable().optional(),
  status: z.enum(['planned', 'in_progress', 'testing', 'ready', 'archived']).optional(), visibility: z.enum(['team', 'private']).optional(),
});
export const PATCH = route<P, typeof Body>({ body: Body }, async ({ user, params, body }) => {
  const b = await canEditBuild(params.id, user);
  if (!b) throw notFound('Build not found');
  if (body.status === 'archived' && !atLeast(user, 'captain') && b.ownerId !== user.id) throw forbidden('Only captains, admins or the owner can archive a build.');
  if (body.visibility && b.ownerId !== user.id && !atLeast(user, 'admin')) throw forbidden('Only the owner can change visibility.');
  await db.update(schema.builds).set({ ...body, updatedAt: new Date() }).where(eq(schema.builds.id, params.id));
  if (body.status && body.status !== b.status) await logActivity({ type: 'build.status', actorId: user.id, entityType: 'build', entityId: b.id, data: { build: body.name ?? b.name, status: body.status }, privateTo: b.visibility === 'private' ? b.ownerId : null });
  return { ok: true };
});

export const DELETE = route<P>({}, async ({ user, params }) => {
  const b = await canEditBuild(params.id, user);
  if (!b) throw notFound('Build not found');
  if (b.ownerId !== user.id && !atLeast(user, 'admin')) throw forbidden('Only the owner or an admin can delete a build.');
  await db.update(schema.builds).set({ deletedAt: new Date(), isTeamActive: false }).where(eq(schema.builds.id, params.id));
  return { ok: true };
});
