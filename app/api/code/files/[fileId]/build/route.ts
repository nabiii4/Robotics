import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { canEditBuild } from '@/lib/services/builds';

export const runtime = 'nodejs';

export const GET = route<{ fileId: string }>({}, async ({ params, user }) => {
  const f = await db.query.codeFiles.findFirst({ where: eq(schema.codeFiles.id, params.fileId) });
  if (!f || !(await canEditBuild(f.buildId, user))) throw notFound('That file no longer exists.');
  return { buildId: f.buildId };
});
