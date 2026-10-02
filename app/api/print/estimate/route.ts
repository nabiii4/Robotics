import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { meshForJobSource } from '@/lib/services/printJobs';
import { estimatePrint } from '@/lib/services/printing';
import { LEGALITY_BADGE } from '@/lib/printing/templates';

export const runtime = 'nodejs';

const Body = z.object({
  customPartId: z.string().optional().nullable(), uploadId: z.string().optional().nullable(),
  material: z.string().default('PLA'), infillPct: z.coerce.number().min(10).max(100).default(20), layerHeightMm: z.coerce.number().min(0.05).max(0.4).default(0.2),
  quantity: z.coerce.number().int().min(1).max(50).default(1), printerId: z.string().optional().nullable(),
});

export const POST = route({ body: Body }, async ({ body }) => {
  const mesh = await meshForJobSource(body);
  const pr = body.printerId ? await db.query.printers.findFirst({ where: eq(schema.printers.id, body.printerId) }) : (await db.select().from(schema.printers))[0];
  const est = estimatePrint({ volumeMm3: mesh.volumeMm3, areaMm2: mesh.areaMm2, material: body.material, infillPct: body.infillPct, layerHeightMm: body.layerHeightMm, quantity: body.quantity, throughput: pr?.throughputGPerMin });
  const size = [0, 1, 2].map((k) => Number(mesh.bbox.max[k]) - Number(mesh.bbox.min[k]));
  const bed = pr?.bedMm ?? [256, 256, 256];
  const part = body.customPartId ? await db.query.customParts.findFirst({ where: eq(schema.customParts.id, body.customPartId) }) : null;
  return {
    ...est, sizeMm: size.map((s) => Math.round(s * 10) / 10), fits: size.every((s, k) => s <= bed[k] + 0.01), bed,
    legality: part ? { key: part.legality, ...LEGALITY_BADGE[part.legality] } : { key: 'practice', ...LEGALITY_BADGE.practice },
  };
});
