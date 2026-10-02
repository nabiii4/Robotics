import { route, notFound } from '@/lib/api';
import { canEditBuild, derivedForVersion, getVersion, statusMap } from '@/lib/services/builds';
import { configPreview } from '@/lib/services/builds';

export const runtime = 'nodejs';
export const GET = route<{ id: string }>({}, async ({ user, params, req }) => {
  const b = await canEditBuild(params.id, user);
  if (!b) throw notFound('Build not found');
  const v = await getVersion(b.id, req.nextUrl.searchParams.get('version'));
  if (!v) throw notFound('This build has no design yet');
  const d = await derivedForVersion(b.id, v);
  const st = await statusMap(b.id);
  const cfg = configPreview(d, v.version);
  return {
    build: { id: b.id, name: b.name, tagline: b.tagline, status: b.status, drawingPrefix: b.drawingPrefix, program: b.program, isTeamActive: b.isTeamActive, visibility: b.visibility, ownerId: b.ownerId, currentVersionId: b.currentVersionId },
    version: v.version, versionId: v.id, isCurrent: v.id === b.currentVersionId, createdAt: v.createdAt.getTime(), source: v.source,
    spec: d.spec, parts: d.gen.parts, bbox: d.gen.bbox, frame: { zF: d.gen.frame.zF, zR: d.gen.frame.zR, crossTop: d.gen.frame.crossTop },
    metrics: d.metrics, ruleChecks: d.ruleChecks, devices: d.devices, bom: d.bom, steps: d.gen.steps, collisions: d.gen.collisions,
    normalizeReport: d.normalizeReport, portReport: d.portReport, statuses: { drivetrain: st.drivetrain ?? 'complete', ...st }, robotConfig: cfg,
  };
});
