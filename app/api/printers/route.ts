import { desc } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { encrypt } from '@/lib/crypto';
import { PrinterBody } from '@/lib/schemas';
import { printerSummary, jobProgress, remoteStatus, tickPrinters } from '@/lib/services/printing';

export const runtime = 'nodejs';

export const GET = route({}, async () => {
  await tickPrinters();
  const s = await printerSummary();
  return {
    status: s.status,
    printers: s.states.map(({ printer: p, state, job }) => {
      const rs = remoteStatus.get(p.id);
      return {
        id: p.id, name: p.name, model: p.model, adapter: p.adapter, baseUrl: p.baseUrl, hasApiKey: !!p.apiKeyEnc, materials: p.materials, bedMm: p.bedMm,
        throughputGPerMin: p.throughputGPerMin, online: p.online, simFrozen: p.simFrozen, lastSeenAt: p.lastSeenAt?.getTime() ?? null, state,
        temps: rs?.temps ?? null,
        job: job ? { id: job.id, name: job.name, material: job.material, color: job.color, ...jobProgress(job) } : null,
      };
    }),
  };
});


export const POST = route({ role: 'admin', body: PrinterBody }, async ({ body }) => {
  const last = await db.select({ s: schema.printers.sortOrder }).from(schema.printers).orderBy(desc(schema.printers.sortOrder)).limit(1);
  const id = newId();
  await db.insert(schema.printers).values({
    id, name: body.name, model: body.model, adapter: body.adapter, baseUrl: body.baseUrl || null, apiKeyEnc: body.apiKey ? encrypt(body.apiKey) : null,
    materials: body.materials, bedMm: body.bedMm, throughputGPerMin: body.throughputGPerMin, online: body.adapter === 'simulated', sortOrder: (last[0]?.s ?? 0) + 1,
  });
  await tickPrinters(true);
  return { id };
});
