import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { route, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { memoryProblem } from '@/lib/ai/memory';

export const runtime = 'nodejs';
type P = { id: string };
const Body = z.object({ text: z.string().min(5).max(200).optional(), pinned: z.boolean().optional(), category: z.enum(['preference', 'skill', 'goal', 'project', 'role', 'struggle']).optional(), importance: z.number().int().min(1).max(5).optional() });
export const PATCH = route<P, typeof Body>({ body: Body }, async ({ user, params, body }) => {
  if (body.text) { const p = memoryProblem(body.text); if (p) throw bad(p); }
  await db.update(schema.memories).set({ ...body, ...(body.text ? { embedding: null } : {}), updatedAt: new Date() }).where(and(eq(schema.memories.id, params.id), eq(schema.memories.userId, user.id)));
  return { ok: true };
});
export const DELETE = route<P>({}, async ({ user, params }) => {
  await db.delete(schema.memories).where(and(eq(schema.memories.id, params.id), eq(schema.memories.userId, user.id)));
  return { ok: true };
});
