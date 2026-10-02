import { and, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { activeBuild, derivedForVersion, getVersion, statusMap } from '@/lib/services/builds';
import { jobProgress, printerSummary, tickPrinters } from '@/lib/services/printing';
import { recentActivity, firstName } from '@/lib/services/activity';
import { readiness } from '@/lib/services/readiness';
import { inventoryMetrics } from '@/lib/services/inventory';
import { PROGRAM_LABEL } from '@/lib/robot/spec';

export const runtime = 'nodejs';

export const GET = route({}, async ({ user }) => {
  await tickPrinters();
  const now = Date.now();
  // --- stats ---
  const pres = await db.select().from(schema.brainPresence).where(gt(schema.brainPresence.lastSeenAt, new Date(now - 30_000))).orderBy(desc(schema.brainPresence.lastSeenAt));
  let brainWho: string | null = null;
  if (pres[0]) { const u = await db.query.users.findFirst({ where: eq(schema.users.id, pres[0].userId) }); brainWho = u ? firstName(u.displayName) : null; }
  const printers = await printerSummary();
  const allJobs = await db.select().from(schema.printJobs).where(inArray(schema.printJobs.status, ['queued', 'printing', 'paused', 'completed'])).orderBy(schema.printJobs.sortOrder, schema.printJobs.createdAt);
  const activeJobs = allJobs.filter((j) => j.status !== 'completed');
  const partsInQueue = activeJobs.reduce((s, j) => s + j.quantity, 0);
  const jobView = (j: typeof allJobs[number]) => {
    const p = jobProgress(j, now);
    return { id: j.id, name: j.name, material: j.material, layer: j.layerHeightMm, color: j.color, quantity: j.quantity, status: j.status, progress: p.progress, remainingSec: p.remainingSec, customPartId: j.customPartId, uploadId: j.uploadId, finishedAt: j.finishedAt?.getTime() ?? null, printerId: j.printerId };
  };
  const queueA = activeJobs.slice(0, 3).map(jobView);
  const recentDone = allJobs.filter((j) => j.status === 'completed' && !j.pickedUp).sort((a, b) => (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0));
  const printingFirst = [...activeJobs.filter((j) => j.status !== 'queued'), ...activeJobs.filter((j) => j.status === 'queued')];
  const merged = [...printingFirst.slice(0, 1), ...recentDone.slice(0, 1), ...printingFirst.slice(1)].slice(0, 4);
  const queueB = merged.map(jobView);

  // --- active build ---
  const b = await activeBuild();
  let build = null as null | Record<string, unknown>;
  if (b) {
    const v = await getVersion(b.id);
    if (v) {
      const d = await derivedForVersion(b.id, v);
      const st = await statusMap(b.id);
      const subs = [{ id: 'drivetrain', name: 'Drivetrain' }, ...d.spec.subsystems.map((s) => ({ id: s.id, name: s.name }))];
      const bpUpdated = v.createdAt.getTime();
      build = {
        id: b.id, name: b.name, tagline: b.tagline, status: b.status, program: d.spec.meta.program, programLabel: PROGRAM_LABEL[d.spec.meta.program],
        version: v.version, versionId: v.id, drawingPrefix: b.drawingPrefix, updatedAt: b.updatedAt.getTime(), blueprintUpdatedAt: bpUpdated,
        metrics: { length: d.metrics.startSize.length, width: d.metrics.startSize.width, height: d.metrics.startSize.height, weight: d.metrics.weightLb },
        subsystems: subs.map((s) => ({ ...s, status: (st[s.id] ?? (s.id === 'drivetrain' ? 'complete' : d.spec.subsystems.find((x) => x.id === s.id)?.status)) as string })),
        failing: d.ruleChecks.filter((c) => c.severity === 'error' && !c.pass).length,
      };
    }
  }

  // --- code: most recently edited student file in the active build ---
  let code = null as null | Record<string, unknown>;
  if (b) {
    const files = await db.select().from(schema.codeFiles).where(eq(schema.codeFiles.buildId, b.id)).orderBy(desc(schema.codeFiles.updatedAt));
    const f = files.find((x) => !x.generated) ?? files[0];
    const last = await db.select().from(schema.compileResults).where(eq(schema.compileResults.buildId, b.id)).orderBy(desc(schema.compileResults.createdAt)).limit(1);
    if (f) code = { fileId: f.id, path: f.path, lines: f.content.split('\n').slice(0, 10), errors: last[0] ? last[0].diagnostics.filter((x) => x.severity === 'error').length : null, engine: last[0]?.engine ?? null };
  }

  const unread = await db.select({ id: schema.notifications.id }).from(schema.notifications).where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
  const inv = await inventoryMetrics();
  const rd = await readiness();
  return {
    now,
    stats: {
      brain: { remoteWho: brainWho, online: !!pres[0] },
      printer: { status: printers.status, printers: printers.states.map((s) => ({ name: s.printer.name, state: s.state, adapter: s.printer.adapter })) },
      partsInQueue,
    },
    build,
    queue: { a: queueA, b: queueB, activeCount: activeJobs.length },
    activity: await recentActivity(user.id, { limit: 5 }),
    readiness: { percent: rd.percent, categories: rd.categories, target: rd.target },
    inventory: inv,
    code,
    unread: unread.length,
  };
});
