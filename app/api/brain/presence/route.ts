import { z } from 'zod';
import { desc, eq, gt, lt } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { firstName } from '@/lib/services/activity';

export const runtime = 'nodejs';

/** Who has a V5 Brain plugged in right now (heartbeat every 15 s, stale after 30 s) — spec §18.7 */
export const GET = route({}, async ({ user }) => {
  const rows = await db.select().from(schema.brainPresence).where(gt(schema.brainPresence.lastSeenAt, new Date(Date.now() - 30_000))).orderBy(desc(schema.brainPresence.lastSeenAt));
  const other = rows.find((r) => r.userId !== user.id) ?? rows[0];
  if (!other) return { online: false, who: null };
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, other.userId) });
  return { online: true, who: other.userId === user.id ? 'you' : u ? firstName(u.displayName) : 'a teammate', portLabel: other.portLabel };
});

export const POST = route({ body: z.object({ portLabel: z.string().max(120).nullable().optional() }) }, async ({ user, body }) => {
  const now = new Date();
  await db.delete(schema.brainPresence).where(lt(schema.brainPresence.lastSeenAt, new Date(now.getTime() - 5 * 60_000)));
  const mine = await db.query.brainPresence.findFirst({ where: eq(schema.brainPresence.userId, user.id) });
  if (body.portLabel === null) { if (mine) await db.delete(schema.brainPresence).where(eq(schema.brainPresence.id, mine.id)); return { ok: true }; }
  if (mine) await db.update(schema.brainPresence).set({ lastSeenAt: now, portLabel: body.portLabel ?? mine.portLabel }).where(eq(schema.brainPresence.id, mine.id));
  else await db.insert(schema.brainPresence).values({ id: newId(), userId: user.id, portLabel: body.portLabel ?? null, lastSeenAt: now });
  return { ok: true };
});
