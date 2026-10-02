import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { derivedForVersion, getVersion, regenerateConfig } from './builds';
import { logActivity } from './activity';
import { compileProject } from '../vexcode/compile';
import { bad, forbidden, notFound } from '../api';

export async function ensureCodeFiles(buildId: string, userId: string) {
  const files = await db.select().from(schema.codeFiles).where(eq(schema.codeFiles.buildId, buildId));
  if (files.length) return files;
  const v = await getVersion(buildId);
  if (!v) return files;
  const d = await derivedForVersion(buildId, v);
  await regenerateConfig(buildId, d, v.version, userId);
  return db.select().from(schema.codeFiles).where(eq(schema.codeFiles.buildId, buildId));
}

export async function projectDevices(buildId: string) {
  const v = await getVersion(buildId);
  if (!v) return [];
  const d = await derivedForVersion(buildId, v);
  return d.devices.map((x) => x.name).concat(['drive', 'leftDrive', 'rightDrive']);
}

export const FILE_ORDER = ['src/main.cpp', 'src/robot-config.cpp', 'include/robot-config.h', 'include/vex.h'];
export function sortFiles<T extends { path: string }>(files: T[]) {
  return [...files].sort((a, b) => {
    const ia = FILE_ORDER.indexOf(a.path), ib = FILE_ORDER.indexOf(b.path);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return a.path.localeCompare(b.path);
  });
}

export async function runCompile(buildId: string, userId: string) {
  const files = await ensureCodeFiles(buildId, userId);
  const r = await compileProject(files.map((f) => ({ path: f.path, content: f.content })), await projectDevices(buildId));
  await db.insert(schema.compileResults).values({ id: newId(), buildId, userId, ok: r.ok, engine: r.engine, diagnostics: r.diagnostics, createdAt: new Date() });
  const errors = r.diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = r.diagnostics.filter((d) => d.severity === 'warning').length;
  return { ...r, errors, warnings, fileIds: Object.fromEntries(files.map((f) => [f.path, f.id])) };
}

export const validPath = (p: string) => /^(src|include)\/[A-Za-z0-9_\-]+\.(cpp|h|hpp)$/.test(p) || /^[A-Za-z0-9_\-]+\.(md|txt)$/.test(p);

/** Save a file (autosave). Writes a code version; the activity line is throttled to once per 30 min per user per file. */
export async function saveFile(fileId: string, content: string, user: { id: string }, message?: string) {
  const f = await db.query.codeFiles.findFirst({ where: eq(schema.codeFiles.id, fileId) });
  if (!f) throw notFound('That file no longer exists.');
  if (f.generated) throw forbidden('This file is generated from the build. Change the build (or regenerate) instead.');
  if (content.length > 200 * 1024) throw bad('File is over 200 KB.');
  if (content === f.content) return { ok: true, unchanged: true };
  const now = new Date();
  await db.update(schema.codeFiles).set({ content, updatedAt: now, updatedBy: user.id }).where(eq(schema.codeFiles.id, f.id));
  const last = await db.select().from(schema.codeVersions).where(eq(schema.codeVersions.fileId, f.id)).orderBy(desc(schema.codeVersions.createdAt)).limit(1);
  // coalesce autosaves by the same author within 2 minutes into one version
  if (last[0] && last[0].authorId === user.id && !message && now.getTime() - last[0].createdAt.getTime() < 120_000 && last[0].message === 'autosave') {
    await db.update(schema.codeVersions).set({ content, createdAt: now }).where(eq(schema.codeVersions.id, last[0].id));
  } else {
    await db.insert(schema.codeVersions).values({ id: newId(), fileId: f.id, content, authorId: user.id, message: message ?? 'autosave', createdAt: now });
  }
  const recent = await db.select().from(schema.activity).where(and(eq(schema.activity.type, 'code.updated'), eq(schema.activity.entityId, f.id), eq(schema.activity.actorId, user.id))).orderBy(desc(schema.activity.createdAt)).limit(1);
  if (!recent[0] || now.getTime() - recent[0].createdAt.getTime() > 30 * 60_000) {
    const label = f.path.split('/').pop()!.replace(/\.(h|cpp|hpp)$/, '').replace(/[-_]/g, ' ').replace(/^main$/, 'robot').replace(/ control$/, '');
    await logActivity({ type: 'code.updated', actorId: user.id, entityType: 'file', entityId: f.id, data: { label } });
  }
  await db.update(schema.builds).set({ updatedAt: now }).where(eq(schema.builds.id, f.buildId));
  return { ok: true };
}

