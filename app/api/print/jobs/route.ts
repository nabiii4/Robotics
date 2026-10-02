import { z } from 'zod';
import { asc, desc, inArray } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { tickPrinters } from '@/lib/services/printing';
import { createPrintJob } from '@/lib/services/printJobs';
import { jobViews } from '@/lib/services/jobViews';
import { rateLimit } from '@/lib/auth/rateLimit';
import { ApiError } from '@/lib/api';

export const runtime = 'nodejs';

export const GET = route({}, async ({ req }) => {
  await tickPrinters();
  const tab = req.nextUrl.searchParams.get('tab') ?? 'active';
  const statuses = tab === 'completed' ? ['completed'] : tab === 'failed' ? ['failed', 'canceled'] : ['queued', 'printing', 'paused'];
  const rows = await db.select().from(schema.printJobs).where(inArray(schema.printJobs.status, statuses as ('queued' | 'printing' | 'paused' | 'completed' | 'failed' | 'canceled')[]))
    .orderBy(...(tab === 'active' ? [asc(schema.printJobs.sortOrder), asc(schema.printJobs.createdAt)] : [desc(schema.printJobs.finishedAt), desc(schema.printJobs.createdAt)])).limit(200);
  const counts = await db.select({ status: schema.printJobs.status }).from(schema.printJobs);
  const c = (s: string[]) => counts.filter((x) => s.includes(x.status)).length;
  return { jobs: await jobViews(rows), counts: { active: c(['queued', 'printing', 'paused']), completed: c(['completed']), failed: c(['failed', 'canceled']) } };
});

const Body = z.object({
  customPartId: z.string().optional().nullable(),
  uploadId: z.string().optional().nullable(),
  name: z.string().trim().max(80).optional(),
  material: z.enum(['PLA', 'PETG', 'ABS', 'ASA', 'TPU']).default('PLA'),
  color: z.string().trim().min(1).max(20).default('black'),
  layerHeightMm: z.coerce.number().refine((v) => [0.12, 0.16, 0.2, 0.28].includes(v), 'Layer height must be 0.12, 0.16, 0.20 or 0.28 mm').default(0.2),
  infillPct: z.coerce.number().int().min(10).max(100).default(20),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
  printerId: z.string().optional().nullable(),
  notes: z.string().max(500).optional(),
});

export const POST = route({ body: Body }, async ({ user, body }) => {
  const rl = await rateLimit(`print:${user.id}`, 30, 60 * 60_000);
  if (!rl.ok) throw new ApiError(429, 'rate_limited', 'That’s a lot of prints — try again in a bit.');
  const r = await createPrintJob({ userId: user.id, ...body, printerId: body.printerId || null, notes: body.notes || undefined });
  return r;
});
