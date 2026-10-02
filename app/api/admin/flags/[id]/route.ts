import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

export const PATCH = route<{ id: string }, z.ZodTypeAny>({ role: 'admin', body: z.object({ status: z.enum(['open', 'reviewed', 'dismissed']) }) }, async ({ params, body }) => {
  await db.update(schema.aiFlags).set({ status: (body as { status: string }).status }).where(eq(schema.aiFlags.id, params.id));
  return { ok: true };
});
