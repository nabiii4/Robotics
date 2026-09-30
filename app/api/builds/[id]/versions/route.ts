import { z } from 'zod';
import { route, notFound, bad } from '@/lib/api';
import { buildWithVersions } from '@/lib/services/buildList';
import { canEditBuild, createVersion } from '@/lib/services/builds';
import { SpecValidationError } from '@/lib/robot/normalize';

export const runtime = 'nodejs';
type P = { id: string };
export const GET = route<P>({}, async ({ user, params }) => {
  if (!(await canEditBuild(params.id, user))) throw notFound('Build not found');
  return { versions: (await buildWithVersions(params.id))?.versions ?? [] };
});
const Body = z.object({ spec: z.unknown(), message: z.string().max(200).optional() });
export const POST = route<P, typeof Body>({ body: Body }, async ({ user, params, body }) => {
  if (!(await canEditBuild(params.id, user))) throw notFound('Build not found');
  try {
    const r = await createVersion({ buildId: params.id, specInput: body.spec, source: 'user', authorId: user.id, changeSummary: body.message ? [body.message] : undefined });
    return { versionId: r.id, version: r.version, diff: r.diff, normalizeReport: r.derived.normalizeReport };
  } catch (e) {
    if (e instanceof SpecValidationError) throw bad(`That spec is not valid: ${e.message}`);
    throw e;
  }
});
