import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { threadMessages } from '@/lib/ai/mentor';

export const runtime = 'nodejs';
type P = { id: string };
async function own(id: string, userId: string) {
  const t = await db.query.chatThreads.findFirst({ where: and(eq(schema.chatThreads.id, id), eq(schema.chatThreads.userId, userId)) });
  if (!t) throw notFound('Conversation not found');
  return t;
}
export const GET = route<P>({}, async ({ user, params }) => {
  const t = await own(params.id, user.id);
  return { thread: { id: t.id, title: t.title, buildId: t.buildId }, messages: await threadMessages(t.id) };
});
const Body = z.object({ title: z.string().trim().min(1).max(80).optional(), buildId: z.string().nullable().optional() });
export const PATCH = route<P, typeof Body>({ body: Body }, async ({ user, params, body }) => {
  await own(params.id, user.id);
  await db.update(schema.chatThreads).set(body).where(eq(schema.chatThreads.id, params.id));
  return { ok: true };
});
export const DELETE = route<P>({}, async ({ user, params }) => {
  await own(params.id, user.id);
  await db.delete(schema.chatMessages).where(eq(schema.chatMessages.threadId, params.id));
  await db.delete(schema.chatThreads).where(eq(schema.chatThreads.id, params.id));
  return { ok: true };
});
