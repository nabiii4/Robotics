import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { addMemory, listMemories } from '@/lib/ai/memory';

export const runtime = 'nodejs';
export const GET = route({}, async ({ user }) => ({ memories: (await listMemories(user.id)).map((m) => ({ ...m, createdAt: m.createdAt.getTime(), updatedAt: m.updatedAt.getTime(), lastUsedAt: m.lastUsedAt?.getTime() ?? null })) }));
const Body = z.object({ category: z.enum(['preference', 'skill', 'goal', 'project', 'role', 'struggle']), text: z.string().min(5).max(200), importance: z.number().int().min(1).max(5).default(3) });
export const POST = route({ body: Body }, async ({ user, body }) => {
  const r = await addMemory(user.id, body);
  if ('error' in r) throw bad(r.error);
  return r;
});
export const DELETE = route({}, async ({ user }) => { await db.delete(schema.memories).where(eq(schema.memories.userId, user.id)); return { ok: true }; });
