import { eq } from 'drizzle-orm';
import { route, notFound } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { logActivity } from '@/lib/services/activity';

export const runtime = 'nodejs';

/** Exactly one target event at a time. */
export const POST = route<{ id: string }>({ role: 'captain' }, async ({ params, user }) => {
  const c = await db.query.competitions.findFirst({ where: eq(schema.competitions.id, params.id) });
  if (!c) throw notFound('That event no longer exists.');
  await db.update(schema.competitions).set({ isTarget: false }).where(eq(schema.competitions.isTarget, true));
  await db.update(schema.competitions).set({ isTarget: true }).where(eq(schema.competitions.id, c.id));
  await logActivity({ type: 'competition.target', actorId: user.id, entityType: 'competition', entityId: c.id, data: { event: c.shortName } });
  return { ok: true };
});
