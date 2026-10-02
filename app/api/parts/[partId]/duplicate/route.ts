import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { canEditBuild } from '@/lib/services/builds';

export const runtime = 'nodejs';

export const POST = route<{ partId: string }>({}, async ({ params, user }) => {
  const p = await db.query.customParts.findFirst({ where: eq(schema.customParts.id, params.partId) });
  if (!p || !(await canEditBuild(p.buildId, user))) throw notFound('That part no longer exists.');
  const id = newId();
  const now = new Date();
  await db.insert(schema.customParts).values({ ...p, id, name: `${p.name} (copy)`.slice(0, 60), createdBy: user.id, createdAt: now, updatedAt: now });
  return { id };
});
