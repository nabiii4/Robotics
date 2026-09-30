import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { firstName } from './activity';

export async function listBuilds(viewerId: string) {
  const rows = await db.select().from(schema.builds).where(isNull(schema.builds.deletedAt)).orderBy(desc(schema.builds.isTeamActive), desc(schema.builds.updatedAt));
  const visible = rows.filter((b) => b.visibility === 'team' || b.ownerId === viewerId);
  if (!visible.length) return [];
  const ids = visible.map((b) => b.id);
  const versions = await db.select({ id: schema.buildVersions.id, buildId: schema.buildVersions.buildId, version: schema.buildVersions.version, authorId: schema.buildVersions.authorId, createdAt: schema.buildVersions.createdAt, source: schema.buildVersions.source }).from(schema.buildVersions).where(inArray(schema.buildVersions.buildId, ids));
  const tasks = await db.select({ buildId: schema.tasks.buildId, status: schema.tasks.status, category: schema.tasks.category, weight: schema.tasks.weight }).from(schema.tasks).where(inArray(schema.tasks.buildId, ids));
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName }).from(schema.users);
  const uname = new Map(users.map((u) => [u.id, firstName(u.displayName)]));
  return visible.map((b) => {
    const cur = versions.find((v) => v.id === b.currentVersionId);
    const t = tasks.filter((x) => x.buildId === b.id && x.category !== 'notebook');
    const total = t.reduce((s, x) => s + x.weight, 0);
    const done = t.filter((x) => x.status === 'done').reduce((s, x) => s + x.weight, 0);
    return {
      id: b.id, name: b.name, tagline: b.tagline, status: b.status, program: b.program, visibility: b.visibility, isTeamActive: b.isTeamActive,
      ownerId: b.ownerId, ownerName: uname.get(b.ownerId) ?? '', version: cur?.version ?? 0, versionId: cur?.id ?? null,
      updatedAt: (cur?.createdAt ?? b.updatedAt).getTime(), updatedBy: cur ? uname.get(cur.authorId) ?? '' : '', readiness: total ? done / total : null,
      drawingPrefix: b.drawingPrefix,
    };
  });
}

export async function buildWithVersions(id: string) {
  const b = await db.query.builds.findFirst({ where: and(eq(schema.builds.id, id), isNull(schema.builds.deletedAt)) });
  if (!b) return null;
  const versions = await db.select({ id: schema.buildVersions.id, version: schema.buildVersions.version, source: schema.buildVersions.source, authorId: schema.buildVersions.authorId, diff: schema.buildVersions.diff, changeSummary: schema.buildVersions.changeSummary, createdAt: schema.buildVersions.createdAt }).from(schema.buildVersions).where(eq(schema.buildVersions.buildId, id)).orderBy(desc(schema.buildVersions.version));
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName }).from(schema.users);
  const uname = new Map(users.map((u) => [u.id, u.displayName]));
  return {
    build: { ...b, createdAt: b.createdAt.getTime(), updatedAt: b.updatedAt.getTime(), deletedAt: null },
    versions: versions.map((v) => ({ ...v, author: uname.get(v.authorId) ?? 'Someone', createdAt: v.createdAt.getTime() })),
  };
}
