import { z } from 'zod';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

export const POST = route({ body: z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() }) }, async ({ user, body }) => {
  const now = new Date();
  if (body.all) await db.update(schema.notifications).set({ readAt: now }).where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
  else if (body.ids?.length) await db.update(schema.notifications).set({ readAt: now }).where(and(eq(schema.notifications.userId, user.id), inArray(schema.notifications.id, body.ids)));
  return { ok: true };
});
