import { eq } from 'drizzle-orm';
import { route, notFound, ApiError } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { runCompile } from '@/lib/services/code';
import { rateLimit } from '@/lib/auth/rateLimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = route<{ id: string }>({}, async ({ params, user }) => {
  const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, params.id) });
  if (!b || b.deletedAt) throw notFound('That build doesn’t exist.');
  const rl = await rateLimit(`compile:${user.id}`, 30, 5 * 60_000);
  if (!rl.ok) throw new ApiError(429, 'rate_limited', 'Too many compiles — wait a minute and try again.');
  const r = await runCompile(b.id, user.id);
  return { ok: r.ok, engine: r.engine, errors: r.errors, warnings: r.warnings, diagnostics: r.diagnostics.map((d) => ({ ...d, fileId: r.fileIds[d.file] ?? null })), log: r.log };
});
