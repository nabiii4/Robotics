import { z } from 'zod';
import { desc, eq } from 'drizzle-orm';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { canEditBuild } from '@/lib/services/builds';
import { defaultLegality, partView } from '@/lib/services/parts';
import { logActivity } from '@/lib/services/activity';
import { TEMPLATE_BY_ID, withDefaults } from '@/lib/printing/templates';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params, user }) => {
  const b = await canEditBuild(params.id, user);
  if (!b) throw notFound('That build doesn’t exist.');
  const rows = await db.select().from(schema.customParts).where(eq(schema.customParts.buildId, b.id)).orderBy(desc(schema.customParts.updatedAt));
  return { program: b.program, parts: await Promise.all(rows.map(partView)) };
});

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  template: z.string(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  uploadId: z.string().optional().nullable(),
  material: z.enum(['PLA', 'PETG', 'ABS', 'ASA', 'TPU']).default('PLA'),
  color: z.string().max(20).default('black'),
  defaultQty: z.number().int().min(1).max(50).default(1),
  purpose: z.string().max(200).optional().nullable(),
  legality: z.enum(['practice', 'decoration', 'license_plate', 'vexu_vai_only']).optional(),
});

export const POST = route<{ id: string }, typeof Body>({ body: Body }, async ({ params, user, body }) => {
  const b = await canEditBuild(params.id, user);
  if (!b) throw notFound('That build doesn’t exist.');
  if (body.template === 'custom-stl') {
    if (!body.uploadId) throw bad('Upload an STL first.');
    const up = await db.query.uploads.findFirst({ where: eq(schema.uploads.id, body.uploadId) });
    if (!up || up.kind !== 'stl') throw bad('That upload is not an STL file.');
  } else if (!TEMPLATE_BY_ID[body.template]) throw bad('Unknown template.');
  const id = newId();
  const now = new Date();
  await db.insert(schema.customParts).values({
    id, buildId: b.id, name: body.name, template: body.template, params: body.template === 'custom-stl' ? {} : withDefaults(body.template, body.params),
    material: body.material, color: body.color, defaultQty: body.defaultQty, purpose: body.purpose ?? null, legality: body.legality ?? defaultLegality(b.program, body.template),
    uploadId: body.uploadId ?? null, createdBy: user.id, createdAt: now, updatedAt: now,
  });
  await logActivity({ type: 'part.created', actorId: user.id, entityType: 'part', entityId: id, data: { part: body.name.toLowerCase(), build: b.name, buildId: b.id } });
  return { id };
});
