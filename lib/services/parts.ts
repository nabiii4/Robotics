import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { LEGALITY_BADGE, TEMPLATE_BY_ID, withDefaults } from '../printing/templates';

export type PartRow = typeof schema.customParts.$inferSelect;

export function defaultLegality(program: string, template: string): PartRow['legality'] {
  if (template === 'license-plate-holder') return 'license_plate';
  if (program === 'VEXU' || program === 'VAIRC') return 'vexu_vai_only';
  return 'practice';
}

export async function partView(p: PartRow) {
  const t = TEMPLATE_BY_ID[p.template];
  const up = p.uploadId ? await db.query.uploads.findFirst({ where: eq(schema.uploads.id, p.uploadId) }) : null;
  return {
    id: p.id, buildId: p.buildId, name: p.name, template: p.template, templateName: t?.name ?? 'Custom STL', params: t ? withDefaults(p.template, p.params) : p.params,
    describe: t ? t.describe(withDefaults(p.template, p.params)) : `Uploaded ${up?.filename ?? 'STL'}`,
    material: p.material, color: p.color, defaultQty: p.defaultQty, purpose: p.purpose, legality: p.legality, legalityBadge: LEGALITY_BADGE[p.legality],
    uploadId: p.uploadId, filename: up?.filename ?? null, defaultPrint: t?.defaultPrint ?? null, updatedAt: p.updatedAt.getTime(), createdBy: p.createdBy,
  };
}
