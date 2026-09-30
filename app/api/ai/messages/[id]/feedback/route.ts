import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';
const Body = z.object({ value: z.union([z.literal(1), z.literal(-1), z.literal(0)]) });
export const POST = route<{ id: string }, typeof Body>({ body: Body }, async ({ user, params, body }) => {
  const m = await db.query.chatMessages.findFirst({ where: eq(schema.chatMessages.id, params.id) });
  const t = m ? await db.query.chatThreads.findFirst({ where: eq(schema.chatThreads.id, m.threadId) }) : null;
  if (!m || t?.userId !== user.id) throw notFound();
  await db.update(schema.chatMessages).set({ feedback: body.value || null }).where(eq(schema.chatMessages.id, params.id));
  return { ok: true };
});
