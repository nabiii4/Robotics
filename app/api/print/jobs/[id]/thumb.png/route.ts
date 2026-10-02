import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { sourceThumb } from '@/lib/services/printJobs';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params, req }) => {
  const j = await db.query.printJobs.findFirst({ where: eq(schema.printJobs.id, params.id) });
  if (!j) throw notFound();
  const big = req.nextUrl.searchParams.get('size') === 'lg';
  const png = await sourceThumb(j, j.color, big ? 480 : 200, big ? 360 : 150);
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=3600' } });
});
