import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { derive, deriveFromSpec, type Derived } from '../robot/derive';
import { normalizeSpec } from '../robot/normalize';
import { diffSpecs } from '../robot/diff';
import { OVERRIDE, type SeasonRules } from '../robot/seasons';
import type { RobotSpec } from '../robot/spec';
import { generateRobotConfig, generateMainCpp, VEX_H, controlsMd } from '../vexcode/generate';
import { logActivity } from './activity';
import type { Legality } from '../robot/rules';

export async function activeSeason(): Promise<SeasonRules> {
  const row = await db.query.seasonProfiles.findFirst({ where: eq(schema.seasonProfiles.active, true) });
  return (row?.rules as unknown as SeasonRules) ?? OVERRIDE;
}

const derivedCache = new Map<string, Derived>();

export async function printedPartsFor(buildId: string): Promise<{ name: string; legality: Legality }[]> {
  const rows = await db.select({ name: schema.customParts.name, legality: schema.customParts.legality }).from(schema.customParts).where(eq(schema.customParts.buildId, buildId));
  return rows;
}

export async function getVersion(buildId: string, versionId?: string | null) {
  if (versionId) return db.query.buildVersions.findFirst({ where: and(eq(schema.buildVersions.id, versionId), eq(schema.buildVersions.buildId, buildId)) });
  const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, buildId) });
  if (!b?.currentVersionId) return undefined;
  return db.query.buildVersions.findFirst({ where: eq(schema.buildVersions.id, b.currentVersionId) });
}

export async function derivedForVersion(buildId: string, versionRow: typeof schema.buildVersions.$inferSelect): Promise<Derived> {
  const parts = await printedPartsFor(buildId);
  const key = `${versionRow.id}:${parts.map((p) => p.legality).join(',')}`;
  const hit = derivedCache.get(key);
  if (hit) return hit;
  const season = await activeSeason();
  const d = deriveFromSpec(versionRow.spec as unknown as RobotSpec, { season, printedParts: parts }, (versionRow.normalizeReport as never) ?? []);
  if (derivedCache.size > 200) derivedCache.clear();
  derivedCache.set(key, d);
  return d;
}

export async function statusMap(buildId: string): Promise<Record<string, string>> {
  const rows = await db.select().from(schema.subsystemStatus).where(eq(schema.subsystemStatus.buildId, buildId));
  return Object.fromEntries(rows.map((r) => [r.subsystemId, r.status]));
}

/** Validate/normalize a spec and try it without saving (used by the AI repair loop). */
export async function tryDerive(buildId: string | null, specInput: unknown) {
  let previous: RobotSpec | null = null;
  if (buildId) {
    const v = await getVersion(buildId);
    previous = (v?.spec as unknown as RobotSpec) ?? null;
  }
  const season = await activeSeason();
  const parts = buildId ? await printedPartsFor(buildId) : [];
  return derive(specInput, { previous, season, printedParts: parts });
}

export async function createVersion(args: {
  buildId: string; specInput: unknown; source: 'ai' | 'user' | 'template' | 'import' | 'restore'; authorId: string;
  messageId?: string | null; changeSummary?: string[]; preDerived?: Derived; quiet?: boolean;
}) {
  const build = await db.query.builds.findFirst({ where: eq(schema.builds.id, args.buildId) });
  if (!build) throw new Error('Build not found');
  const prevRow = await getVersion(args.buildId);
  const prevSpec = (prevRow?.spec as unknown as RobotSpec) ?? null;
  const season = await activeSeason();
  const printed = await printedPartsFor(args.buildId);
  const prevDerived = prevRow ? await derivedForVersion(args.buildId, prevRow) : null;
  let d = args.preDerived;
  if (!d) {
    const { spec, report } = normalizeSpec(args.specInput, prevSpec);
    d = deriveFromSpec(spec, { previous: prevSpec, previousDevices: prevDerived?.devices, season, printedParts: printed }, report);
  }
  // keep the build's identity fields in meta
  d.spec.meta.name = build.name;
  if (build.tagline) d.spec.meta.tagline = build.tagline;
  d.spec.meta.drawingPrefix = build.drawingPrefix;
  const diff = diffSpecs(prevSpec, d.spec, prevDerived?.metrics, d.metrics);
  const last = await db.select({ v: schema.buildVersions.version }).from(schema.buildVersions).where(eq(schema.buildVersions.buildId, args.buildId)).orderBy(desc(schema.buildVersions.version)).limit(1);
  const version = (last[0]?.v ?? 0) + 1;
  const id = newId();
  const now = new Date();
  await db.insert(schema.buildVersions).values({
    id, buildId: args.buildId, version, spec: d.spec as unknown as Record<string, unknown>, diff, changeSummary: args.changeSummary ?? null,
    normalizeReport: d.normalizeReport, source: args.source, authorId: args.authorId, messageId: args.messageId ?? null, createdAt: now,
  });
  await db.update(schema.builds).set({ currentVersionId: id, updatedAt: now, program: d.spec.meta.program }).where(eq(schema.builds.id, args.buildId));
  // subsystem statuses follow the spec for new subsystems
  const existing = await statusMap(args.buildId);
  for (const s of d.spec.subsystems) {
    if (!existing[s.id]) await db.insert(schema.subsystemStatus).values({ buildId: args.buildId, subsystemId: s.id, status: s.status, updatedBy: args.authorId, updatedAt: now }).onConflictDoNothing();
  }
  await regenerateConfig(args.buildId, d, version, args.authorId);
  if (!args.quiet) {
    const top = diff[0] ?? 'design updated';
    if (args.source !== 'ai') await logActivity({ type: 'build.version', actorId: args.authorId, entityType: 'build', entityId: args.buildId, data: { build: build.name, top, version }, privateTo: build.visibility === 'private' ? build.ownerId : null });
  }
  derivedCache.clear();
  return { id, version, derived: d, diff, previousVersion: prevRow?.version ?? null };
}

/** Rewrite the generated robot-config files; create main.cpp/vex.h once. */
export async function regenerateConfig(buildId: string, d: Derived, version: number, userId: string) {
  const rc = generateRobotConfig(d.spec, d.devices, version);
  const files = await db.select().from(schema.codeFiles).where(eq(schema.codeFiles.buildId, buildId));
  const now = new Date();
  const upsert = async (path: string, content: string, generated: boolean, onlyIfMissing = false) => {
    const f = files.find((x) => x.path === path);
    if (f) {
      if (onlyIfMissing || f.content === content) return;
      await db.update(schema.codeFiles).set({ content, generated, updatedAt: now, updatedBy: userId }).where(eq(schema.codeFiles.id, f.id));
      await db.insert(schema.codeVersions).values({ id: newId(), fileId: f.id, content, authorId: userId, message: `regenerated from v${version}`, createdAt: now });
    } else {
      const id = newId();
      await db.insert(schema.codeFiles).values({ id, buildId, path, content, generated, updatedBy: userId, updatedAt: now });
      await db.insert(schema.codeVersions).values({ id: newId(), fileId: id, content, authorId: userId, message: 'created', createdAt: now });
    }
  };
  await upsert('src/robot-config.cpp', rc.cpp, true);
  await upsert('include/robot-config.h', rc.h, true);
  await upsert('include/vex.h', VEX_H, true, true);
  await upsert('CONTROLS.md', controlsMd(d.spec, d.devices), true);
  await upsert('src/main.cpp', generateMainCpp(d.spec, d.devices), false, true);
}

export function configPreview(d: Derived, version: number) {
  return generateRobotConfig(d.spec, d.devices, version);
}

export async function visibleBuilds(userId: string) {
  const rows = await db.select().from(schema.builds).where(isNull(schema.builds.deletedAt)).orderBy(desc(schema.builds.updatedAt));
  return rows.filter((b) => b.visibility === 'team' || b.ownerId === userId);
}

export async function activeBuild() {
  return db.query.builds.findFirst({ where: and(eq(schema.builds.isTeamActive, true), isNull(schema.builds.deletedAt)) });
}

export async function versionsFor(buildIds: string[]) {
  if (!buildIds.length) return [];
  return db.select().from(schema.buildVersions).where(inArray(schema.buildVersions.buildId, buildIds));
}

export async function canEditBuild(buildId: string, user: { id: string; role: string }) {
  const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, buildId) });
  if (!b || b.deletedAt) return null;
  if (b.visibility === 'private' && b.ownerId !== user.id) return null;
  return b;
}
