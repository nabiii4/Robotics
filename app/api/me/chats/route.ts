import { eq, inArray } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
export const runtime = 'nodejs';
export const DELETE = route({}, async ({ user }) => {
  const threads = await db.select({ id: schema.chatThreads.id }).from(schema.chatThreads).where(eq(schema.chatThreads.userId, user.id));
  if (threads.length) await db.delete(schema.chatMessages).where(inArray(schema.chatMessages.threadId, threads.map((t) => t.id)));
  await db.delete(schema.chatThreads).where(eq(schema.chatThreads.userId, user.id));
  return { ok: true };
});
