import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { LEGALITY_BADGE, TEMPLATE_BY_ID } from '@/lib/printing/templates';

export const runtime = 'nodejs';

/** Printed parts from every build this user can see, plus their STL uploads (Send to Printer, step 1). */
export const GET = route({}, async ({ user }) => {
  const builds = (await db.select().from(schema.builds).where(isNull(schema.builds.deletedAt))).filter((b) => b.visibility === 'team' || b.ownerId === user.id);
  const ids = builds.map((b) => b.id);
  const parts = ids.length ? await db.select().from(schema.customParts).where(inArray(schema.customParts.buildId, ids)).orderBy(desc(schema.customParts.updatedAt)) : [];
  const uploads = await db.select().from(schema.uploads).where(and(eq(schema.uploads.kind, 'stl'))).orderBy(desc(schema.uploads.createdAt)).limit(50);
  return {
    parts: parts.map((p) => ({
      id: p.id, name: p.name, buildId: p.buildId, buildName: builds.find((b) => b.id === p.buildId)?.name ?? '', template: TEMPLATE_BY_ID[p.template]?.name ?? 'Custom STL',
      material: p.material, color: p.color, defaultQty: p.defaultQty, legality: { key: p.legality, ...LEGALITY_BADGE[p.legality] },
    })),
    uploads: uploads.map((u) => ({ id: u.id, filename: u.filename, size: u.size, createdAt: u.createdAt.getTime() })),
  };
});
