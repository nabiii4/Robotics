import { route, notFound } from '@/lib/api';
import { canEditBuild, getVersion } from '@/lib/services/builds';

export const runtime = 'nodejs';
export const GET = route<{ id: string }>({}, async ({ user, params }) => {
  const b = await canEditBuild(params.id, user);
  const v = b ? await getVersion(b.id) : null;
  if (!b || !v) throw notFound('Build not found');
  return new Response(JSON.stringify(v.spec, null, 2), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${b.drawingPrefix}_v${v.version}_RobotSpec.json"` } });
});
