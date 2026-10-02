import { eq } from 'drizzle-orm';
import { zipSync } from 'fflate';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { canEditBuild } from '@/lib/services/builds';
import { sourceFile } from '@/lib/services/printJobs';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params, user }) => {
  const b = await canEditBuild(params.id, user);
  if (!b) throw notFound();
  const parts = await db.select().from(schema.customParts).where(eq(schema.customParts.buildId, b.id));
  if (!parts.length) throw bad('This build has no printed parts yet.');
  const out: Record<string, Uint8Array> = {};
  for (const p of parts) {
    const f = await sourceFile({ customPartId: p.id }, p.name);
    let name = f.filename;
    for (let i = 2; out[name]; i++) name = f.filename.replace(/\.stl$/, `_${i}.stl`);
    out[name] = new Uint8Array(f.buf);
  }
  return new Response(new Uint8Array(zipSync(out, { level: 6 })), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${b.drawingPrefix}_printed_parts.zip"` } });
});
