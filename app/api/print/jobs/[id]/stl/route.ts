import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { sourceFile } from '@/lib/services/printJobs';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params }) => {
  const j = await db.query.printJobs.findFirst({ where: eq(schema.printJobs.id, params.id) });
  if (!j) throw notFound();
  const f = await sourceFile(j, j.name);
  return new Response(new Uint8Array(f.buf), { headers: { 'content-type': f.mime, 'content-disposition': `attachment; filename="${f.filename}"` } });
});
