import { and, eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { canEditBuild, createVersion } from '@/lib/services/builds';

export const runtime = 'nodejs';
export const POST = route<{ id: string; v: string }>({}, async ({ user, params }) => {
  if (!(await canEditBuild(params.id, user))) throw notFound('Build not found');
  const row = await db.query.buildVersions.findFirst({ where: and(eq(schema.buildVersions.buildId, params.id), eq(schema.buildVersions.id, params.v)) });
  if (!row) throw notFound('Version not found');
  const r = await createVersion({ buildId: params.id, specInput: row.spec, source: 'restore', authorId: user.id, changeSummary: [`Restored v${row.version}`] });
  return { versionId: r.id, version: r.version, diff: r.diff };
});
