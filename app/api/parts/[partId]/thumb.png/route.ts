import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { sourceThumb } from '@/lib/services/printJobs';

export const runtime = 'nodejs';

export const GET = route<{ partId: string }>({}, async ({ params, req }) => {
  const p = await db.query.customParts.findFirst({ where: eq(schema.customParts.id, params.partId) });
  if (!p) throw notFound();
  const big = req.nextUrl.searchParams.get('size') === 'lg';
  const png = await sourceThumb({ customPartId: p.id }, req.nextUrl.searchParams.get('color') || p.color, big ? 480 : 200, big ? 360 : 150);
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=600' } });
});
