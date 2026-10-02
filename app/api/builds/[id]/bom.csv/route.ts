import { route, notFound } from '@/lib/api';
import { canEditBuild, derivedForVersion, getVersion } from '@/lib/services/builds';
import { bomCsv } from '@/lib/robot/bom';

export const runtime = 'nodejs';
export const GET = route<{ id: string }>({}, async ({ user, params }) => {
  const b = await canEditBuild(params.id, user);
  const v = b ? await getVersion(b.id) : null;
  if (!b || !v) throw notFound('Build not found');
  const d = await derivedForVersion(b.id, v);
  return new Response(bomCsv(d.bom), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${b.drawingPrefix}_v${v.version}_BOM.csv"` } });
});
