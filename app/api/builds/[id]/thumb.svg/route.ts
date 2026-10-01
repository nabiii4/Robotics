import { route, notFound } from '@/lib/api';
import { canEditBuild, derivedForVersion, getVersion } from '@/lib/services/builds';
import { thumbnailSvg } from '@/lib/blueprint/sheets';

export const runtime = 'nodejs';

const cache = new Map<string, string>();

/** Build card thumbnail, cached per version (spec §15.10). ?style=a|b picks the blueprint theme. */
export const GET = route<{ id: string }>({}, async ({ params, user, req }) => {
  const b = await canEditBuild(params.id, user);
  const v = b ? await getVersion(b.id) : null;
  if (!b || !v) throw notFound();
  const style = req.nextUrl.searchParams.get('style') === 'b' ? 'b' : 'a';
  const key = `${v.id}:${style}`;
  let svg = cache.get(key);
  if (!svg) {
    const d = await derivedForVersion(b.id, v);
    svg = thumbnailSvg(d.gen.parts, style, `${b.drawingPrefix}_v${v.version}`);
    if (cache.size > 200) cache.clear();
    cache.set(key, svg);
  }
  return new Response(svg, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'private, max-age=86400', etag: key } });
});
