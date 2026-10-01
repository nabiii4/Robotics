import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { meshForJobSource } from '@/lib/services/printJobs';

export const runtime = 'nodejs';

/** Mesh for the in-browser 3D preview (mm, Z up). */
export const GET = route<{ partId: string }>({}, async ({ params }) => {
  const p = await db.query.customParts.findFirst({ where: eq(schema.customParts.id, params.partId) });
  if (!p) throw notFound();
  const m = await meshForJobSource({ customPartId: p.id });
  return { positions: Array.from(m.positions, (v) => Math.round(v * 100) / 100), indices: Array.from(m.indices), bbox: m.bbox, volumeMm3: m.volumeMm3, color: p.color };
});
