import { and, eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { saveFile } from '@/lib/services/code';

export const runtime = 'nodejs';

export const POST = route<{ fileId: string; versionId: string }>({}, async ({ params, user }) => {
  const v = await db.query.codeVersions.findFirst({ where: and(eq(schema.codeVersions.id, params.versionId), eq(schema.codeVersions.fileId, params.fileId)) });
  if (!v) throw notFound('That version no longer exists.');
  return saveFile(params.fileId, v.content, user, `restored version from ${v.createdAt.toLocaleString('en-US')}`);
});
