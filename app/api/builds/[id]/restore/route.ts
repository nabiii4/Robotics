import { and, eq, isNotNull } from 'drizzle-orm';
import { route, notFound, forbidden, atLeast } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

/** Undo a soft delete (kept for 30 days). */
export const POST = route<{ id: string }>({}, async ({ user, params }) => {
  const b = await db.query.builds.findFirst({ where: and(eq(schema.builds.id, params.id), isNotNull(schema.builds.deletedAt)) });
  if (!b) throw notFound('That build isn’t in Recently deleted.');
  if (b.ownerId !== user.id && !atLeast(user, 'admin')) throw forbidden('Only the owner or an admin can restore this build.');
  await db.update(schema.builds).set({ deletedAt: null, updatedAt: new Date() }).where(eq(schema.builds.id, b.id));
  return { ok: true };
});
