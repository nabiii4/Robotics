import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { env } from '../env';
import { partMesh, parseStl, meshStats } from '../printing/geometry';
import { estimatePrint, tickPrinters } from './printing';
import { logActivity } from './activity';
import { bad } from '../api';

export async function meshForJobSource(src: { customPartId?: string | null; uploadId?: string | null }) {
  if (src.customPartId) {
    const p = await db.query.customParts.findFirst({ where: eq(schema.customParts.id, src.customPartId) });
    if (!p) throw bad('That printed part no longer exists.');
    if (p.template === 'custom-stl' && p.uploadId) return { ...(await uploadMesh(p.uploadId)), name: p.name, color: p.color };
    const m = await partMesh(p.template, p.params);
    return { positions: m.positions, indices: m.indices, volumeMm3: m.volumeMm3, areaMm2: m.areaMm2, bbox: m.bbox, name: p.name, color: p.color };
  }
  if (src.uploadId) return { ...(await uploadMesh(src.uploadId)), name: '', color: 'gray' };
  throw bad('Choose a printed part or upload an STL.');
}

export async function uploadMesh(uploadId: string) {
  const up = await db.query.uploads.findFirst({ where: eq(schema.uploads.id, uploadId) });
  if (!up || up.kind !== 'stl') throw bad('That upload is not an STL file.');
  const buf = fs.readFileSync(path.join(path.resolve(env().UPLOAD_DIR), up.storageKey));
  const mesh = parseStl(buf);
  const st = meshStats(mesh);
  return { positions: mesh.positions, indices: mesh.indices, volumeMm3: st.volumeMm3, areaMm2: st.areaMm2, bbox: st.bbox as { min: number[]; max: number[] }, filename: up.filename };
}

export async function createPrintJob(a: {
  userId: string; customPartId?: string | null; uploadId?: string | null; name?: string; material: string; color: string;
  layerHeightMm: number; infillPct: number; quantity: number; printerId?: string | null; notes?: string;
}) {
  const mesh = await meshForJobSource(a);
  const printer = a.printerId ? await db.query.printers.findFirst({ where: eq(schema.printers.id, a.printerId) }) : null;
  const bed = printer?.bedMm ?? [256, 256, 256];
  const size = [0, 1, 2].map((k) => (mesh.bbox.max[k] as number) - (mesh.bbox.min[k] as number));
  if (size.some((s, k) => s > bed[k] + 0.01)) throw bad(`That part (${size.map((s) => s.toFixed(0)).join(' × ')} mm) does not fit the printer bed.`);
  const est = estimatePrint({ volumeMm3: mesh.volumeMm3, areaMm2: mesh.areaMm2, material: a.material, infillPct: a.infillPct, layerHeightMm: a.layerHeightMm, quantity: a.quantity, throughput: printer?.throughputGPerMin });
  const last = await db.select({ s: schema.printJobs.sortOrder }).from(schema.printJobs).orderBy(desc(schema.printJobs.sortOrder)).limit(1);
  const name = a.name || mesh.name || ('filename' in mesh ? String(mesh.filename).replace(/\.stl$/i, '') : 'Print');
  const shortLabel = /bracket|mount/i.test(name) ? 'bracket' : name.toLowerCase();
  const id = newId();
  const now = new Date();
  await db.insert(schema.printJobs).values({
    id, customPartId: a.customPartId ?? null, uploadId: a.uploadId ?? null, name, shortLabel, material: a.material, color: a.color,
    layerHeightMm: a.layerHeightMm, infillPct: a.infillPct, quantity: a.quantity, printerId: a.printerId ?? null, status: 'queued', sortOrder: (last[0]?.s ?? 0) + 1,
    estSeconds: est.timeSec, estGrams: est.totalG, requestedBy: a.userId, notes: a.notes ?? null, history: [{ at: now.getTime(), status: 'queued', by: a.userId }], createdAt: now,
  });
  await logActivity({ type: 'print.queued', actorId: a.userId, entityType: 'job', entityId: id, data: { shortLabel, job: name } });
  await tickPrinters(true);
  return { id, estimate: est };
}
