import { desc, eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { ensureCodeFiles, projectDevices, sortFiles } from '@/lib/services/code';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params, user }) => {
  const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, params.id) });
  if (!b || b.deletedAt || (b.visibility === 'private' && b.ownerId !== user.id)) throw notFound('That build doesn’t exist.');
  const files = sortFiles(await ensureCodeFiles(b.id, user.id));
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName }).from(schema.users);
  const last = await db.select().from(schema.compileResults).where(eq(schema.compileResults.buildId, b.id)).orderBy(desc(schema.compileResults.createdAt)).limit(1);
  return {
    build: { id: b.id, name: b.name, drawingPrefix: b.drawingPrefix, autonStart: b.autonStart ?? null },
    files: files.map((f) => ({ id: f.id, path: f.path, content: f.content, generated: f.generated, updatedAt: f.updatedAt.getTime(), updatedBy: users.find((u) => u.id === f.updatedBy)?.displayName ?? null })),
    devices: await projectDevices(b.id),
    lastCompile: last[0] ? { ok: last[0].ok, engine: last[0].engine, diagnostics: last[0].diagnostics, createdAt: last[0].createdAt.getTime() } : null,
  };
});
