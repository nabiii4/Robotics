import { z } from 'zod';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { canEditBuild } from '@/lib/services/builds';

export const runtime = 'nodejs';
const Body = z.object({ status: z.enum(['complete', 'in_progress', 'planned']) });
export const PATCH = route<{ id: string; subId: string }, typeof Body>({ body: Body }, async ({ user, params, body }) => {
  if (!(await canEditBuild(params.id, user))) throw notFound('Build not found');
  await db.insert(schema.subsystemStatus).values({ buildId: params.id, subsystemId: params.subId, status: body.status, updatedBy: user.id, updatedAt: new Date() })
    .onConflictDoUpdate({ target: [schema.subsystemStatus.buildId, schema.subsystemStatus.subsystemId], set: { status: body.status, updatedBy: user.id, updatedAt: new Date() } });
  return { ok: true };
});
