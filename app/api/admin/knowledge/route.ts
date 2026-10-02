import { eq } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

export const GET = route({ role: 'admin' }, async () => {
  const ups = await db.select().from(schema.uploads).where(eq(schema.uploads.useForAi, true));
  const chunks = await db.select({ uploadId: schema.knowledgeChunks.uploadId, embedding: schema.knowledgeChunks.embedding, ruleIds: schema.knowledgeChunks.ruleIds }).from(schema.knowledgeChunks);
  return {
    docs: ups.map((u) => {
      const c = chunks.filter((x) => x.uploadId === u.id);
      return { id: u.id, title: u.title ?? u.filename, filename: u.filename, kind: u.kind, chunks: c.length, embedded: c.filter((x) => x.embedding).length, ruleIds: [...new Set(c.flatMap((x) => x.ruleIds))].length, createdAt: u.createdAt.getTime() };
    }),
  };
});
