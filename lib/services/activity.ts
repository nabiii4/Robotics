import { and, desc, eq, inArray, isNull, lt, or } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';

export async function logActivity(a: { type: string; actorId: string | null; entityType?: string; entityId?: string; data?: Record<string, unknown>; privateTo?: string | null; at?: Date }) {
  await db.insert(schema.activity).values({
    id: newId(), actorId: a.actorId, type: a.type, entityType: a.entityType ?? null, entityId: a.entityId ?? null,
    data: a.data ?? {}, privateTo: a.privateTo ?? null, createdAt: a.at ?? new Date(),
  });
}

export async function notify(userId: string, n: { type: string; title: string; body?: string; link?: string; at?: Date }) {
  await db.insert(schema.notifications).values({ id: newId(), userId, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null, createdAt: n.at ?? new Date() });
}

export async function notifyRoles(roles: ('admin' | 'captain' | 'member')[], n: { type: string; title: string; body?: string; link?: string }) {
  const us = await db.select({ id: schema.users.id }).from(schema.users).where(and(inArray(schema.users.role, roles), eq(schema.users.disabled, false)));
  for (const u of us) await notify(u.id, n);
}

export type ActivityRow = typeof schema.activity.$inferSelect;
export interface ActivityView {
  id: string; type: string; createdAt: number; actor: { id: string; name: string; initial: string; color: string } | null;
  text: string; parts: { t: string; link?: string; underline?: boolean; strong?: boolean }[]; href: string;
}

export const firstName = (displayName: string) => displayName.split(/\s+/)[0] ?? displayName;

/** Sentence templates (spec §20.1) */
export function describe(row: ActivityRow, actorName: string): { parts: ActivityView['parts']; href: string } {
  const d = row.data as Record<string, string | number | undefined>;
  const who = { t: actorName, strong: true };
  switch (row.type) {
    case 'file.uploaded': return { parts: [who, { t: ' uploaded ' }, { t: String(d.filename ?? 'a file'), underline: true, link: `/uploads/${row.entityId}` }], href: `/uploads/${row.entityId}` };
    case 'print.queued': return { parts: [who, { t: ` sent ${d.shortLabel ?? 'a part'} to printer` }], href: `/printer?job=${row.entityId}` };
    case 'print.completed': return { parts: [{ t: `${d.job ?? 'A print'} finished printing` }], href: `/printer?job=${row.entityId}` };
    case 'code.updated': return { parts: [who, { t: ` updated ${d.label ?? 'robot'} code` }], href: `/code?file=${row.entityId}` };
    case 'inventory.added': return { parts: [who, { t: d.qty ? ` added ${d.qty} new parts to inventory` : ` added ${d.subcategory ?? 'parts'} to inventory` }], href: `/parts?item=${row.entityId}` };
    case 'task.completed': return { parts: [who, { t: ` completed ${String(d.title ?? 'a task').toLowerCase()}` }], href: `/team?tab=tasks&task=${row.entityId}` };
    case 'build.version': return { parts: [who, { t: ` updated ${d.build}: ${d.top}` }], href: `/builds/${row.entityId}` };
    case 'ai.design': return { parts: [{ t: 'AI Mentor', strong: true }, { t: ` updated ${d.build} for ${d.firstName}${d.top ? `: ${d.top}` : ''}` }], href: `/builds/${row.entityId}` };
    case 'build.status': return { parts: [who, { t: ` marked ${d.build} ${String(d.status ?? '').replace('_', ' ')}` }], href: `/builds/${row.entityId}` };
    case 'build.created': return { parts: [who, { t: ` started a new build: ${d.build}` }], href: `/builds/${row.entityId}` };
    case 'competition.target': return { parts: [who, { t: ` set ${d.event} as the target` }], href: `/competitions/${row.entityId}` };
    case 'order.received': return { parts: [who, { t: ` received ${d.qty} × ${d.name}` }], href: '/parts?tab=orders' };
    default: return { parts: [who, { t: ` ${row.type}` }], href: '/' };
  }
}

export async function recentActivity(viewerId: string, opts: { limit?: number; before?: number; type?: string; actorId?: string } = {}): Promise<ActivityView[]> {
  const limit = opts.limit ?? 20;
  const conds = [or(isNull(schema.activity.privateTo), eq(schema.activity.privateTo, viewerId))];
  if (opts.before) conds.push(lt(schema.activity.createdAt, new Date(opts.before)));
  if (opts.type) conds.push(eq(schema.activity.type, opts.type));
  if (opts.actorId) conds.push(eq(schema.activity.actorId, opts.actorId));
  const rows = await db.select().from(schema.activity).where(and(...conds)).orderBy(desc(schema.activity.createdAt)).limit(limit);
  const ids = [...new Set(rows.map((r) => r.actorId).filter(Boolean) as string[])];
  const us = ids.length ? await db.select().from(schema.users).where(inArray(schema.users.id, ids)) : [];
  const map = new Map(us.map((u) => [u.id, u]));
  return rows.map((r) => {
    const u = r.actorId ? map.get(r.actorId) : undefined;
    const name = u ? firstName(u.displayName) : 'Someone';
    const { parts, href } = describe(r, name);
    return {
      id: r.id, type: r.type, createdAt: r.createdAt.getTime(),
      actor: u ? { id: u.id, name, initial: (u.avatarText ?? u.displayName).charAt(0).toUpperCase(), color: u.avatarColor } : null,
      text: parts.map((p) => p.t).join(''), parts, href,
    };
  });
}
