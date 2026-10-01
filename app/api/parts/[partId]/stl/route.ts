import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { sourceFile } from '@/lib/services/printJobs';

export const runtime = 'nodejs';

export const GET = route<{ partId: string }>({}, async ({ params }) => {
  const p = await db.query.customParts.findFirst({ where: eq(schema.customParts.id, params.partId) });
  if (!p) throw notFound();
  const f = await sourceFile({ customPartId: p.id }, p.name);
  return new Response(new Uint8Array(f.buf), { headers: { 'content-type': 'model/stl', 'content-disposition': `attachment; filename="${f.filename}"` } });
});
