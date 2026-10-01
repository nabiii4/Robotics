import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound, forbidden, atLeast, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { deleteUpload } from '@/lib/services/uploads';
import { indexUpload } from '@/lib/ai/knowledge';

export const runtime = 'nodejs';
export const maxDuration = 120;

const Patch = z.object({ title: z.string().trim().max(120).nullable().optional(), category: z.string().trim().max(40).nullable().optional(), useForAi: z.boolean().optional() });

export const PATCH = route<{ id: string }, typeof Patch>({ body: Patch }, async ({ params, body, user }) => {
  const up = await db.query.uploads.findFirst({ where: eq(schema.uploads.id, params.id) });
  if (!up) throw notFound('That file no longer exists.');
  if (up.ownerId !== user.id && !atLeast(user, 'captain')) throw forbidden();
  const set: Partial<typeof schema.uploads.$inferInsert> = {};
  if (body.title !== undefined) set.title = body.title || null;
  if (body.category !== undefined) set.category = body.category || null;
  let chunks: number | undefined;
  if (body.useForAi !== undefined) {
    if (!atLeast(user, 'captain')) throw forbidden('Only captains and admins can add documents to the AI knowledge base.');
    if (body.useForAi && !['pdf', 'text'].includes(up.kind)) throw bad('Only PDFs and text files can be used for AI.');
    set.useForAi = body.useForAi;
    if (body.useForAi) {
      try { chunks = await indexUpload(up.id); } catch (e) { throw bad(`Could not read that document: ${(e as Error).message}`); }
    } else await db.delete(schema.knowledgeChunks).where(eq(schema.knowledgeChunks.uploadId, up.id));
  }
  await db.update(schema.uploads).set(set).where(eq(schema.uploads.id, up.id));
  return { ok: true, chunks };
});

export const DELETE = route<{ id: string }>({}, async ({ params, user }) => {
  const up = await db.query.uploads.findFirst({ where: eq(schema.uploads.id, params.id) });
  if (!up) throw notFound('That file no longer exists.');
  if (up.ownerId !== user.id && !atLeast(user, 'admin')) throw forbidden('Only the uploader or an admin can delete this file.');
  const used = await db.query.printJobs.findFirst({ where: eq(schema.printJobs.uploadId, up.id) });
  if (used && ['queued', 'printing', 'paused'].includes(used.status)) throw bad('That file is in the print queue.');
  await deleteUpload(up.id);
  return { ok: true };
});
