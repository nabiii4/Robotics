import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { canEditBuild, createVersion, getVersion } from '@/lib/services/builds';

export const runtime = 'nodejs';
export const POST = route<{ id: string }>({}, async ({ user, params }) => {
  const b = await canEditBuild(params.id, user);
  const v = b ? await getVersion(b.id) : null;
  if (!b || !v) throw notFound('Build not found');
  const id = newId();
  const now = new Date();
  await db.insert(schema.builds).values({ ...b, id, name: `${b.name} (copy)`.slice(0, 60), ownerId: user.id, isTeamActive: false, currentVersionId: null, status: 'planned', createdAt: now, updatedAt: now, deletedAt: null });
  await createVersion({ buildId: id, specInput: v.spec, source: 'user', authorId: user.id, quiet: true });
  const parts = await db.select().from(schema.customParts).where(eq(schema.customParts.buildId, b.id));
  for (const p of parts) await db.insert(schema.customParts).values({ ...p, id: newId(), buildId: id, createdAt: now, updatedAt: now });
  return { id };
});
