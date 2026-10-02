import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { tickPrinters } from '@/lib/services/printing';

export const runtime = 'nodejs';

/** Simulated-printer controls (Settings → Printers): go online/offline, freeze the clock, finish the current job now. */
export const POST = route<{ id: string }, z.ZodTypeAny>({ role: 'admin', body: z.object({ action: z.enum(['online', 'offline', 'freeze', 'unfreeze', 'finish']) }) }, async ({ params, body }) => {
  const p = await db.query.printers.findFirst({ where: eq(schema.printers.id, params.id) });
  if (!p) throw notFound('That printer doesn’t exist.');
  if (p.adapter !== 'simulated') throw bad('These controls are only for simulated printers.');
  const a = (body as { action: string }).action;
  if (a === 'online' || a === 'offline') await db.update(schema.printers).set({ online: a === 'online' }).where(eq(schema.printers.id, p.id));
  if (a === 'freeze' || a === 'unfreeze') await db.update(schema.printers).set({ simFrozen: a === 'freeze' }).where(eq(schema.printers.id, p.id));
  if (a === 'finish') {
    const [j] = await db.select().from(schema.printJobs).where(and(eq(schema.printJobs.printerId, p.id), inArray(schema.printJobs.status, ['printing', 'paused'])));
    if (!j) throw bad('That printer isn’t running a job.');
    // move the start back so the job is done on the next tick
    await db.update(schema.printJobs).set({ status: 'printing', pausedAt: null, pausedMs: 0, startedAt: new Date(Date.now() - j.estSeconds * 1000 - 1000) }).where(eq(schema.printJobs.id, j.id));
    await db.update(schema.printers).set({ simFrozen: false }).where(eq(schema.printers.id, p.id));
  }
  await tickPrinters(true);
  return { ok: true };
});
