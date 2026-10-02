import { desc, inArray } from 'drizzle-orm';
import { route, ApiError } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { saveUpload } from '@/lib/services/uploads';
import { logActivity } from '@/lib/services/activity';
import { rateLimit } from '@/lib/auth/rateLimit';

export const runtime = 'nodejs';

export const GET = route({}, async ({ req }) => {
  const kind = req.nextUrl.searchParams.get('kind');
  const docs = req.nextUrl.searchParams.get('docs') === '1';
  let rows = await db.select().from(schema.uploads).orderBy(desc(schema.uploads.createdAt)).limit(500);
  if (kind) rows = rows.filter((r) => r.kind === kind);
  if (docs) rows = rows.filter((r) => r.kind === 'pdf' || r.kind === 'image' || r.kind === 'text' || r.category);
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName }).from(schema.users);
  const ids = rows.map((r) => r.id);
  const chunks = ids.length ? await db.select({ uploadId: schema.knowledgeChunks.uploadId }).from(schema.knowledgeChunks).where(inArray(schema.knowledgeChunks.uploadId, ids)) : [];
  return {
    uploads: rows.map((r) => ({
      id: r.id, filename: r.filename, title: r.title, category: r.category, kind: r.kind, mime: r.mime, size: r.size, useForAi: r.useForAi,
      chunks: chunks.filter((c) => c.uploadId === r.id).length, ownerId: r.ownerId, ownerName: users.find((u) => u.id === r.ownerId)?.displayName ?? 'Someone', createdAt: r.createdAt.getTime(),
    })),
  };
});

export const POST = route({}, async ({ req, user }) => {
  const rl = await rateLimit(`upload:${user.id}`, 60, 60 * 60_000);
  if (!rl.ok) throw new ApiError(429, 'rate_limited', 'Too many uploads — try again later.');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'bad_request', 'Choose a file to upload.');
  const allow = form?.get('allow') ? String(form.get('allow')).split(',') : undefined;
  const r = await saveUpload(file, user.id, { category: (form?.get('category') as string) || null, title: (form?.get('title') as string) || null, allow });
  if (r.kind === 'stl' || form?.get('category')) await logActivity({ type: 'file.uploaded', actorId: user.id, entityType: 'upload', entityId: r.id, data: { filename: r.filename } });
  return r;
});
