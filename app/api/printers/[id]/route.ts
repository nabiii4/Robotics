import { and, eq, inArray } from 'drizzle-orm';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { encrypt } from '@/lib/crypto';
import { tickPrinters } from '@/lib/services/printing';
import { PrinterBody } from '@/lib/schemas';

export const runtime = 'nodejs';

export const PATCH = route<{ id: string }, ReturnType<typeof PrinterBody.partial>>({ role: 'admin', body: PrinterBody.partial() }, async ({ params, body }) => {
  const p = await db.query.printers.findFirst({ where: eq(schema.printers.id, params.id) });
  if (!p) throw notFound('That printer doesn’t exist.');
  const set: Partial<typeof schema.printers.$inferInsert> = {};
  if (body.name !== undefined) set.name = body.name;
  if (body.model !== undefined) set.model = body.model;
  if (body.adapter !== undefined) { set.adapter = body.adapter; if (body.adapter === 'simulated') set.online = true; }
  if (body.baseUrl !== undefined) set.baseUrl = body.baseUrl || null;
  if (body.apiKey) set.apiKeyEnc = encrypt(body.apiKey);
  if (body.materials) set.materials = body.materials;
  if (body.bedMm) set.bedMm = body.bedMm;
  if (body.throughputGPerMin !== undefined) set.throughputGPerMin = body.throughputGPerMin;
  await db.update(schema.printers).set(set).where(eq(schema.printers.id, p.id));
  await tickPrinters(true);
  return { ok: true };
});

export const DELETE = route<{ id: string }>({ role: 'admin' }, async ({ params }) => {
  const busy = await db.select({ id: schema.printJobs.id }).from(schema.printJobs).where(and(eq(schema.printJobs.printerId, params.id), inArray(schema.printJobs.status, ['printing', 'paused'])));
  if (busy.length) throw bad('That printer is running a job. Cancel or finish it first.');
  await db.update(schema.printJobs).set({ printerId: null }).where(and(eq(schema.printJobs.printerId, params.id), eq(schema.printJobs.status, 'queued')));
  await db.delete(schema.printers).where(eq(schema.printers.id, params.id));
  return { ok: true };
});
