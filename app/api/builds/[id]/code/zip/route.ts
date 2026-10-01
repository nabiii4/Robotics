import { eq } from 'drizzle-orm';
import { zipSync, strToU8 } from 'fflate';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { derivedForVersion, getVersion } from '@/lib/services/builds';
import { ensureCodeFiles } from '@/lib/services/code';
import { projectReadme } from '@/lib/vexcode/generate';

export const runtime = 'nodejs';

/** {drawingPrefix}_code_v{n}.zip — project files, CONTROLS.md, port map, README (spec §18.8) */
export const GET = route<{ id: string }>({}, async ({ params, user }) => {
  const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, params.id) });
  if (!b || b.deletedAt) throw notFound('That build doesn’t exist.');
  const v = await getVersion(b.id);
  const files = await ensureCodeFiles(b.id, user.id);
  const root = `${b.drawingPrefix}_code`;
  const out: Record<string, Uint8Array> = {};
  for (const f of files) out[`${root}/${f.path}`] = strToU8(f.content);
  if (v) {
    const d = await derivedForVersion(b.id, v);
    out[`${root}/README.md`] = strToU8(projectReadme(d.spec, v.version));
    out[`${root}/PORTS.md`] = strToU8(`# Port map — ${b.name} v${v.version}\n\n| Port | Device | Type | Notes |\n|---|---|---|---|\n${d.devices.map((x) => `| ${x.port ?? '—'} | ${x.name} | ${x.type}${x.motorType ? ` (${x.motorType})` : ''} | ${x.reversed ? 'reversed' : ''} |`).join('\n')}\n`);
  }
  const zip = zipSync(out, { level: 6 });
  return new Response(new Uint8Array(zip), { headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${root}_v${v?.version ?? 0}.zip"` } });
});
