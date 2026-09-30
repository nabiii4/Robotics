import { and, asc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { logActivity, notify } from './activity';
import { octoprintStatus, moonrakerStatus, type RemoteStatus } from '../printing/adapters';

export type JobRow = typeof schema.printJobs.$inferSelect;
export type PrinterRow = typeof schema.printers.$inferSelect;

export function jobProgress(j: JobRow, now = Date.now()): { progress: number; remainingSec: number } {
  if (j.status === 'completed') return { progress: 1, remainingSec: 0 };
  if (!j.startedAt || j.status === 'queued') return { progress: 0, remainingSec: j.estSeconds };
  const endRef = j.status === 'paused' && j.pausedAt ? j.pausedAt.getTime() : now;
  const elapsed = Math.max(0, (endRef - j.startedAt.getTime() - j.pausedMs) / 1000);
  const p = Math.min(1, elapsed / Math.max(1, j.estSeconds));
  return { progress: p, remainingSec: Math.max(0, Math.round(j.estSeconds - elapsed)) };
}

const push = (j: JobRow, status: string, by?: string, note?: string) => [...(j.history ?? []), { at: Date.now(), status, by, note }];

let lastTick = 0;
/** Advance simulated printers and assign queued jobs (runs on every queue read, at most once per second). */
export async function tickPrinters(force = false) {
  const nowMs = Date.now();
  if (!force && nowMs - lastTick < 1000) return;
  lastTick = nowMs;
  const now = new Date(nowMs);
  const printers = await db.select().from(schema.printers).orderBy(asc(schema.printers.sortOrder));
  const active = await db.select().from(schema.printJobs).where(inArray(schema.printJobs.status, ['printing', 'paused', 'queued'])).orderBy(asc(schema.printJobs.sortOrder), asc(schema.printJobs.createdAt));
  // remote adapters: pull status
  for (const pr of printers) {
    if (pr.adapter === 'simulated') continue;
    let st: RemoteStatus | null = null;
    try { st = pr.adapter === 'octoprint' ? await octoprintStatus(pr) : await moonrakerStatus(pr); } catch { st = null; }
    await db.update(schema.printers).set({ online: !!st, lastSeenAt: st ? now : pr.lastSeenAt }).where(eq(schema.printers.id, pr.id));
    pr.online = !!st;
  }
  // complete simulated jobs
  for (const j of active) {
    if (j.status !== 'printing') continue;
    const pr = printers.find((p) => p.id === j.printerId);
    if (pr?.simFrozen) continue;
    if (pr && pr.adapter !== 'simulated') continue;
    const { progress } = jobProgress(j, nowMs);
    if (progress >= 1) {
      const finishedAt = new Date(j.startedAt!.getTime() + j.pausedMs + j.estSeconds * 1000);
      await db.update(schema.printJobs).set({ status: 'completed', finishedAt, history: push(j, 'completed') }).where(eq(schema.printJobs.id, j.id));
      j.status = 'completed';
      await notify(j.requestedBy, { type: 'print.completed', title: `${j.name} finished printing`, body: `${j.quantity} × ${j.name} on ${pr?.name ?? 'the printer'}`, link: `/printer?job=${j.id}` });
      await logActivity({ type: 'print.completed', actorId: null, entityType: 'job', entityId: j.id, data: { job: j.name }, at: finishedAt });
    }
  }
  // assign queued jobs to idle online printers with the material
  const busy = new Set(active.filter((j) => j.status === 'printing' || j.status === 'paused').map((j) => j.printerId));
  for (const j of active) {
    if (j.status !== 'queued') continue;
    const candidates = printers.filter((p) => p.online && !busy.has(p.id) && p.materials.includes(j.material) && (!j.printerId || j.printerId === p.id));
    const pr = candidates[0];
    if (!pr) continue;
    busy.add(pr.id);
    await db.update(schema.printJobs).set({ status: 'printing', printerId: pr.id, startedAt: now, pausedMs: 0, history: push(j, 'printing', undefined, pr.name) }).where(eq(schema.printJobs.id, j.id));
  }
}

export function printerState(pr: PrinterRow, jobs: JobRow[]) {
  const job = jobs.find((j) => j.printerId === pr.id && (j.status === 'printing' || j.status === 'paused'));
  if (!pr.online) return { state: 'offline' as const, job };
  if (!job) return { state: 'idle' as const, job };
  return { state: job.status === 'paused' ? ('paused' as const) : ('printing' as const), job };
}

export async function printerSummary() {
  const printers = await db.select().from(schema.printers).orderBy(asc(schema.printers.sortOrder));
  const jobs = await db.select().from(schema.printJobs).where(inArray(schema.printJobs.status, ['printing', 'paused']));
  const states = printers.map((p) => ({ printer: p, ...printerState(p, jobs) }));
  const online = states.filter((s) => s.state !== 'offline');
  const status = online.length === 0 ? 'OFFLINE' : online.some((s) => s.state === 'idle') ? 'READY' : 'BUSY';
  return { status, states };
}

export async function activeJobs() {
  return db.select().from(schema.printJobs).where(and(inArray(schema.printJobs.status, ['queued', 'printing', 'paused']))).orderBy(asc(schema.printJobs.sortOrder), asc(schema.printJobs.createdAt));
}

/** Estimates (spec §17.3) */
export const DENSITY: Record<string, number> = { PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, TPU: 1.21 };
export function estimatePrint(a: { volumeMm3: number; areaMm2: number; material: string; infillPct: number; layerHeightMm: number; quantity: number; throughput?: number; walls?: number }) {
  const walls = a.walls ?? 3;
  const shell = Math.min(0.9, (a.areaMm2 * walls * 0.42) / Math.max(1, a.volumeMm3));
  const infill = Math.min(1, Math.max(0.05, a.infillPct / 100));
  const fill = 1 - (1 - infill) * (1 - shell);
  const massG = (a.volumeMm3 / 1000) * (DENSITY[a.material] ?? 1.24) * fill;
  const tp = a.throughput ?? 0.35;
  const timeMin = (a.quantity * massG) / (tp * (a.layerHeightMm / 0.2)) * 0.92 + 4;
  return { massG: Math.round(massG * 10) / 10, totalG: Math.round(massG * a.quantity * 10) / 10, timeSec: Math.round(timeMin * 60) };
}
