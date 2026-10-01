import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { route, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { tickPrinters } from '@/lib/services/printing';

export const runtime = 'nodejs';

/** Drag-to-reorder: the full list of active job ids in their new order. */
export const POST = route({ body: z.object({ ids: z.array(z.string()).min(1).max(500) }) }, async ({ body }) => {
  const active = await db.select({ id: schema.printJobs.id }).from(schema.printJobs).where(inArray(schema.printJobs.status, ['queued', 'printing', 'paused']));
  const set = new Set(active.map((a) => a.id));
  if (body.ids.some((id) => !set.has(id))) throw bad('The queue changed — refresh and try again.');
  for (let i = 0; i < body.ids.length; i++) await db.update(schema.printJobs).set({ sortOrder: i + 1 }).where(eq(schema.printJobs.id, body.ids[i]));
  await tickPrinters(true);
  return { ok: true };
});
