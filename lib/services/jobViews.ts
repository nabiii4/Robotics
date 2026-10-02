import 'server-only';
import { inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { jobProgress, type JobRow } from './printing';
import { LEGALITY_BADGE } from '../printing/templates';

export async function jobViews(rows: JobRow[], now = Date.now()) {
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName, avatarColor: schema.users.avatarColor }).from(schema.users);
  const printers = await db.select({ id: schema.printers.id, name: schema.printers.name, adapter: schema.printers.adapter }).from(schema.printers);
  const partIds = rows.map((r) => r.customPartId).filter(Boolean) as string[];
  const parts = partIds.length ? await db.select({ id: schema.customParts.id, legality: schema.customParts.legality, buildId: schema.customParts.buildId, template: schema.customParts.template }).from(schema.customParts).where(inArray(schema.customParts.id, partIds)) : [];
  const uname = new Map(users.map((u) => [u.id, u]));
  return rows.map((j) => {
    const p = jobProgress(j, now);
    const part = parts.find((x) => x.id === j.customPartId);
    const pr = printers.find((x) => x.id === j.printerId);
    const u = uname.get(j.requestedBy);
    return {
      id: j.id, name: j.name, material: j.material, color: j.color, layer: j.layerHeightMm, infill: j.infillPct, quantity: j.quantity,
      status: j.status, progress: p.progress, remainingSec: p.remainingSec, estSeconds: j.estSeconds, estGrams: j.estGrams,
      printerId: j.printerId, printerName: pr?.name ?? null, printerAdapter: pr?.adapter ?? null,
      requestedBy: { id: j.requestedBy, name: u?.displayName ?? 'Someone', color: u?.avatarColor ?? '#8A9097' },
      customPartId: j.customPartId, uploadId: j.uploadId, buildId: part?.buildId ?? null, template: part?.template ?? null,
      legality: part ? LEGALITY_BADGE[part.legality] ?? null : null,
      startedAt: j.startedAt?.getTime() ?? null, finishedAt: j.finishedAt?.getTime() ?? null, createdAt: j.createdAt.getTime(),
      pickedUp: j.pickedUp, notes: j.notes, failReason: j.failReason, sortOrder: j.sortOrder,
      history: j.history.map((h) => ({ ...h, byName: h.by ? uname.get(h.by)?.displayName ?? null : null })),
      actualSeconds: j.startedAt && j.finishedAt ? Math.round((j.finishedAt.getTime() - j.startedAt.getTime() - j.pausedMs) / 1000) : null,
    };
  });
}
export type JobView = Awaited<ReturnType<typeof jobViews>>[number];
