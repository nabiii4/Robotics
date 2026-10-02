import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { jobViews } from '@/lib/services/jobViews';
import { tickPrinters } from '@/lib/services/printing';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params }) => {
  await tickPrinters();
  const j = await db.query.printJobs.findFirst({ where: eq(schema.printJobs.id, params.id) });
  if (!j) throw notFound('That print job no longer exists.');
  const [view] = await jobViews([j]);
  return { job: view };
});

const Patch = z.object({ notes: z.string().max(1000).nullable().optional(), printerId: z.string().nullable().optional() });
export const PATCH = route<{ id: string }, typeof Patch>({ body: Patch }, async ({ params, body, user }) => {
  const j = await db.query.printJobs.findFirst({ where: eq(schema.printJobs.id, params.id) });
  if (!j) throw notFound('That print job no longer exists.');
  const set: Partial<typeof schema.printJobs.$inferInsert> = {};
  if (body.notes !== undefined) set.notes = body.notes || null;
  if (body.printerId !== undefined) {
    if (j.status !== 'queued') throw bad('Only queued jobs can be moved to another printer.');
    if (body.printerId) {
      const pr = await db.query.printers.findFirst({ where: eq(schema.printers.id, body.printerId) });
      if (!pr) throw bad('That printer doesn’t exist.');
      if (!pr.materials.includes(j.material)) throw bad(`${pr.name} isn’t loaded with ${j.material}.`);
    }
    set.printerId = body.printerId || null;
    set.history = [...j.history, { at: Date.now(), status: 'queued', by: user.id, note: body.printerId ? 'Assigned printer' : 'Any printer' }];
  }
  await db.update(schema.printJobs).set(set).where(eq(schema.printJobs.id, j.id));
  await tickPrinters(true);
  return { ok: true };
});
