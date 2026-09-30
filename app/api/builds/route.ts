import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { listBuilds } from '@/lib/services/buildList';
import { createVersion, getVersion } from '@/lib/services/builds';
import { logActivity, firstName } from '@/lib/services/activity';
import { TEMPLATES } from '@/lib/robot/defaults';
import { runMentor } from '@/lib/ai/mentor';

export const runtime = 'nodejs';
export const maxDuration = 120;

export const GET = route({}, async ({ user }) => ({ builds: await listBuilds(user.id) }));

const Body = z.object({
  name: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(80).optional().nullable(),
  program: z.enum(['V5RC', 'VEXU', 'VAIRC', 'Practice']).default('V5RC'),
  visibility: z.enum(['team', 'private']).default('team'),
  start: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('template'), template: z.string() }),
    z.object({ kind: z.literal('duplicate'), buildId: z.string() }),
    z.object({ kind: z.literal('import'), spec: z.unknown() }),
    z.object({ kind: z.literal('ai'), prompt: z.string().min(3).max(4000) }),
  ]),
});

export const POST = route({ body: Body }, async ({ user, body }) => {
  const id = newId();
  const now = new Date();
  const prefix = body.name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'Robot';
  const season = body.program === 'Practice' ? 'practice' : body.program === 'V5RC' ? 'v5rc-2026-27-override' : 'vexu-2026-27';
  await db.insert(schema.builds).values({ id, name: body.name, tagline: body.tagline || null, drawingPrefix: prefix, program: body.program, seasonProfileId: season, status: 'planned', visibility: body.visibility, ownerId: user.id, isTeamActive: false, createdAt: now, updatedAt: now });
  const withMeta = (spec: Record<string, unknown>) => ({ ...spec, meta: { ...(spec.meta as object), name: body.name, program: body.program } });
  let source: 'template' | 'import' | 'user' | 'ai' = 'template';
  let spec: unknown;
  let ai: unknown = null;
  let fallback = false;
  if (body.start.kind === 'template') {
    const t = TEMPLATES[body.start.template] ?? TEMPLATES['competition-base'];
    spec = withMeta(t.spec(body.name) as unknown as Record<string, unknown>);
  } else if (body.start.kind === 'duplicate') {
    const v = await getVersion(body.start.buildId);
    if (!v) throw bad('That build has no design yet.');
    spec = withMeta(v.spec); source = 'user';
  } else if (body.start.kind === 'import') {
    spec = withMeta((body.start.spec ?? {}) as Record<string, unknown>); source = 'import';
  } else {
    try {
      ai = await runMentor({ user, message: body.start.prompt, buildId: id, mode: 'create' });
      const applied = (ai as { applied?: unknown }).applied;
      if (applied) {
        await logActivity({ type: 'build.created', actorId: user.id, entityType: 'build', entityId: id, data: { build: body.name } });
        return { id, ai, fallback: false };
      }
    } catch { /* fall back below */ }
    fallback = true;
    spec = withMeta(TEMPLATES['competition-base'].spec(body.name) as unknown as Record<string, unknown>);
  }
  try {
    await createVersion({ buildId: id, specInput: spec, source, authorId: user.id, quiet: true });
  } catch (e) {
    await db.delete(schema.builds).where(eq(schema.builds.id, id));
    throw bad(`That design could not be used: ${(e as Error).message}`);
  }
  await logActivity({ type: 'build.created', actorId: user.id, entityType: 'build', entityId: id, data: { build: body.name, by: firstName(user.displayName) }, privateTo: body.visibility === 'private' ? user.id : null });
  return { id, ai, fallback };
});
