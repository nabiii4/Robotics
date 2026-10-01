import { z } from 'zod';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { route, notFound, bad, forbidden, atLeast } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { tickPrinters } from '@/lib/services/printing';
import { createPrintJob, remoteCommand } from '@/lib/services/printJobs';
import { logActivity, notify } from '@/lib/services/activity';

export const runtime = 'nodejs';

const Body = z.object({ reason: z.string().max(300).optional() }).passthrough();

export const POST = route<{ id: string; action: string }>({}, async ({ req, params, user }) => {
  const body = Body.parse(await req.json().catch(() => ({})));
  await tickPrinters(true);
  const j = await db.query.printJobs.findFirst({ where: eq(schema.printJobs.id, params.id) });
  if (!j) throw notFound('That print job no longer exists.');
  const now = new Date();
  const hist = (status: string, note?: string) => [...j.history, { at: now.getTime(), status, by: user.id, note }];
  const mine = j.requestedBy === user.id || atLeast(user, 'captain');
  switch (params.action) {
    case 'pause': {
      if (j.status !== 'printing') throw bad('Only a printing job can be paused.');
      await remoteCommand(j.printerId, 'pause');
      await db.update(schema.printJobs).set({ status: 'paused', pausedAt: now, history: hist('paused') }).where(eq(schema.printJobs.id, j.id));
      break;
    }
    case 'resume': {
      if (j.status !== 'paused') throw bad('That job isn’t paused.');
      await remoteCommand(j.printerId, 'resume');
      const extra = j.pausedAt ? now.getTime() - j.pausedAt.getTime() : 0;
      await db.update(schema.printJobs).set({ status: 'printing', pausedAt: null, pausedMs: j.pausedMs + extra, history: hist('printing', 'Resumed') }).where(eq(schema.printJobs.id, j.id));
      break;
    }
    case 'cancel': {
      if (!mine) throw forbidden('Only the person who queued it or a captain can cancel this job.');
      if (!['queued', 'printing', 'paused'].includes(j.status)) throw bad('That job is already finished.');
      if (j.status !== 'queued') await remoteCommand(j.printerId, 'cancel');
      await db.update(schema.printJobs).set({ status: 'canceled', finishedAt: now, history: hist('canceled') }).where(eq(schema.printJobs.id, j.id));
      await logActivity({ type: 'print.canceled', actorId: user.id, entityType: 'job', entityId: j.id, data: { job: j.name } });
      break;
    }
    case 'fail': {
      if (!['printing', 'paused', 'completed'].includes(j.status)) throw bad('Only a started job can be marked failed.');
      if (j.status !== 'completed') await remoteCommand(j.printerId, 'cancel');
      const reason = body.reason?.trim() || 'No reason given';
      await db.update(schema.printJobs).set({ status: 'failed', finishedAt: now, failReason: reason, history: hist('failed', reason) }).where(eq(schema.printJobs.id, j.id));
      if (j.requestedBy !== user.id) await notify(j.requestedBy, { type: 'print.failed', title: `${j.name} failed`, body: reason, link: `/printer?job=${j.id}` });
      await logActivity({ type: 'print.failed', actorId: user.id, entityType: 'job', entityId: j.id, data: { job: j.name, reason } });
      break;
    }
    case 'reprint': {
      const r = await createPrintJob({ userId: user.id, customPartId: j.customPartId, uploadId: j.uploadId, name: j.name, material: j.material, color: j.color, layerHeightMm: j.layerHeightMm, infillPct: j.infillPct, quantity: j.quantity, printerId: null, notes: j.notes ?? undefined });
      return { ok: true, id: r.id };
    }
    case 'picked-up': {
      if (j.status !== 'completed') throw bad('Only a finished print can be picked up.');
      await db.update(schema.printJobs).set({ pickedUp: true, history: hist('picked_up') }).where(eq(schema.printJobs.id, j.id));
      break;
    }
    case 'up':
    case 'down': {
      if (!['queued', 'printing', 'paused'].includes(j.status)) throw bad('Only jobs in the queue can be moved.');
      const q = await db.select().from(schema.printJobs).where(inArray(schema.printJobs.status, ['queued', 'printing', 'paused'])).orderBy(asc(schema.printJobs.sortOrder), asc(schema.printJobs.createdAt));
      const i = q.findIndex((x) => x.id === j.id);
      const k = params.action === 'up' ? i - 1 : i + 1;
      if (k < 0 || k >= q.length) return { ok: true, moved: false };
      [q[i], q[k]] = [q[k], q[i]];
      for (let n = 0; n < q.length; n++) await db.update(schema.printJobs).set({ sortOrder: n + 1 }).where(and(eq(schema.printJobs.id, q[n].id)));
      break;
    }
    default:
      throw notFound('Unknown action.');
  }
  await tickPrinters(true);
  return { ok: true };
});
