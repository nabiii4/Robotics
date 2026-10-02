import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { canEditBuild } from '@/lib/services/builds';

export const runtime = 'nodejs';
export const POST = route<{ id: string }>({ role: 'captain' }, async ({ user, params }) => {
  const b = await canEditBuild(params.id, user);
  if (!b) throw notFound('Build not found');
  await db.update(schema.builds).set({ isTeamActive: false }).where(eq(schema.builds.isTeamActive, true));
  await db.update(schema.builds).set({ isTeamActive: true, visibility: 'team' }).where(eq(schema.builds.id, b.id));
  return { ok: true };
});
