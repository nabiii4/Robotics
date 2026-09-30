import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { notifyRoles } from '@/lib/services/activity';

export const runtime = 'nodejs';
const Body = z.object({ reason: z.string().max(300).default('') });
export const POST = route<{ id: string }, typeof Body>({ body: Body }, async ({ user, params, body }) => {
  const m = await db.query.chatMessages.findFirst({ where: eq(schema.chatMessages.id, params.id) });
  const t = m ? await db.query.chatThreads.findFirst({ where: eq(schema.chatThreads.id, m.threadId) }) : null;
  if (!m || t?.userId !== user.id) throw notFound();
  await db.update(schema.chatMessages).set({ flagged: true }).where(eq(schema.chatMessages.id, params.id));
  await db.insert(schema.aiFlags).values({ id: newId(), messageId: params.id, userId: user.id, reason: body.reason || null, createdAt: new Date() });
  await notifyRoles(['admin'], { type: 'ai.flag', title: 'A mentor reply was flagged for review', link: '/settings/ai' });
  return { ok: true };
});
