import { z } from 'zod';
import { route, bad } from '@/lib/api';
import { partMesh } from '@/lib/printing/geometry';
import { TEMPLATE_BY_ID, withDefaults } from '@/lib/printing/templates';
import { estimatePrint } from '@/lib/services/printing';

export const runtime = 'nodejs';

/** Live preview while editing template parameters: mesh + estimate, nothing saved. */
export const POST = route({ body: z.object({ template: z.string(), params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}), material: z.string().default('PLA') }) }, async ({ body }) => {
  const t = TEMPLATE_BY_ID[body.template];
  if (!t) throw bad('Unknown template.');
  const p = withDefaults(body.template, body.params);
  const m = await partMesh(body.template, p);
  const est = estimatePrint({ volumeMm3: m.volumeMm3, areaMm2: m.areaMm2, material: body.material, infillPct: t.defaultPrint.infillPct, layerHeightMm: t.defaultPrint.layerHeightMm, quantity: 1, walls: t.defaultPrint.walls });
  return {
    params: p, describe: t.describe(p), positions: Array.from(m.positions, (v) => Math.round(v * 100) / 100), indices: Array.from(m.indices),
    bbox: m.bbox, volumeMm3: Math.round(m.volumeMm3), estimate: est, defaultPrint: t.defaultPrint,
  };
});
