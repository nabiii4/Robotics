import { eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { route, publicUser } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
export const runtime = 'nodejs';
export const GET = route({}, async ({ user }) => {
  const threads = await db.select().from(schema.chatThreads).where(eq(schema.chatThreads.userId, user.id));
  const messages = threads.length ? await db.select().from(schema.chatMessages).where(inArray(schema.chatMessages.threadId, threads.map((t) => t.id))) : [];
  const mems = await db.select({ id: schema.memories.id, category: schema.memories.category, text: schema.memories.text, importance: schema.memories.importance, pinned: schema.memories.pinned, createdAt: schema.memories.createdAt }).from(schema.memories).where(eq(schema.memories.userId, user.id));
  const data = { exportedAt: new Date().toISOString(), profile: publicUser(user), threads, messages: messages.map((m) => ({ ...m, envelope: undefined })), memories: mems };
  return new NextResponse(JSON.stringify(data, null, 2), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="fdrhs-${user.username}-data.json"` } });
});
