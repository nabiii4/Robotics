import { and, eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { derivedForVersion, getVersion, regenerateConfig } from '@/lib/services/builds';
import { generateRobotConfig } from '@/lib/vexcode/generate';

export const runtime = 'nodejs';

/** Preview: what robot-config would become (shown as a diff before applying). */
export const GET = route<{ id: string }>({}, async ({ params }) => {
  const v = await getVersion(params.id);
  if (!v) throw notFound('That build has no design yet.');
  const d = await derivedForVersion(params.id, v);
  const rc = generateRobotConfig(d.spec, d.devices, v.version);
  const cur = async (p: string) => (await db.query.codeFiles.findFirst({ where: and(eq(schema.codeFiles.buildId, params.id), eq(schema.codeFiles.path, p)) }))?.content ?? '';
  return {
    version: v.version,
    files: [
      { path: 'src/robot-config.cpp', before: await cur('src/robot-config.cpp'), after: rc.cpp },
      { path: 'include/robot-config.h', before: await cur('include/robot-config.h'), after: rc.h },
    ],
  };
});

export const POST = route<{ id: string }>({}, async ({ params, user }) => {
  const v = await getVersion(params.id);
  if (!v) throw notFound('That build has no design yet.');
  await regenerateConfig(params.id, await derivedForVersion(params.id, v), v.version, user.id);
  return { ok: true, version: v.version };
});
