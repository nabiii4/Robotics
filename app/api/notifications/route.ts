import { and, desc, eq, isNull } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

/** Notification type → Settings → Notifications key */
const NOTIF_GROUP = (type: string) => type.split('.')[0];

export const GET = route({}, async ({ user }) => {
  const off = Object.entries(user.prefs.notif ?? {}).filter(([, v]) => v === false).map(([k]) => k);
  const rows = (await db.select().from(schema.notifications).where(eq(schema.notifications.userId, user.id)).orderBy(desc(schema.notifications.createdAt)).limit(60))
    .filter((n) => !off.includes(NOTIF_GROUP(n.type))).slice(0, 20);
  const unread = (await db.select({ id: schema.notifications.id, type: schema.notifications.type }).from(schema.notifications).where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt))))
    .filter((n) => !off.includes(NOTIF_GROUP(n.type))).length;
  return { items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, readAt: n.readAt?.getTime() ?? null, createdAt: n.createdAt.getTime() })), unread };
});
