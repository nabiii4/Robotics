import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { route, notFound, bad, forbidden } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { saveFile, validPath } from '@/lib/services/code';

export const runtime = 'nodejs';

export const PUT = route<{ fileId: string }, z.ZodTypeAny>({ body: z.object({ content: z.string().max(200 * 1024), message: z.string().max(120).optional() }) }, async ({ params, body, user }) => {
  const b = body as { content: string; message?: string };
  return saveFile(params.fileId, b.content, user, b.message);
});

export const PATCH = route<{ fileId: string }, z.ZodTypeAny>({ body: z.object({ path: z.string().trim().min(3).max(80) }) }, async ({ params, body }) => {
  const f = await db.query.codeFiles.findFirst({ where: eq(schema.codeFiles.id, params.fileId) });
  if (!f) throw notFound('That file no longer exists.');
  const p = (body as { path: string }).path;
  if (f.generated || f.path === 'src/main.cpp') throw forbidden('This file can’t be renamed.');
  if (!validPath(p)) throw bad('Use a name like src/arm.cpp or include/arm.h.');
  const dup = await db.query.codeFiles.findFirst({ where: and(eq(schema.codeFiles.buildId, f.buildId), eq(schema.codeFiles.path, p)) });
  if (dup) throw bad('A file with that name already exists.');
  await db.update(schema.codeFiles).set({ path: p, updatedAt: new Date() }).where(eq(schema.codeFiles.id, f.id));
  return { ok: true };
});

export const DELETE = route<{ fileId: string }>({}, async ({ params }) => {
  const f = await db.query.codeFiles.findFirst({ where: eq(schema.codeFiles.id, params.fileId) });
  if (!f) throw notFound('That file no longer exists.');
  if (f.generated || f.path === 'src/main.cpp') throw forbidden('This file can’t be deleted.');
  await db.delete(schema.codeVersions).where(eq(schema.codeVersions.fileId, f.id));
  await db.delete(schema.codeFiles).where(eq(schema.codeFiles.id, f.id));
  return { ok: true };
});
