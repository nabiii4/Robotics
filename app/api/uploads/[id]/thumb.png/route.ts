import { route } from '@/lib/api';
import { sourceThumb } from '@/lib/services/printJobs';

export const runtime = 'nodejs';

export const GET = route<{ id: string }>({}, async ({ params, req }) => {
  const color = req.nextUrl.searchParams.get('color') ?? 'gray';
  const png = await sourceThumb({ uploadId: params.id }, color);
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=3600' } });
});
