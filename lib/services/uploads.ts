import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { env } from '../env';
import { sha256 } from '../crypto';
import { bad } from '../api';

const EXT_KIND: Record<string, (typeof schema.uploads.$inferInsert)['kind']> = {
  stl: 'stl', '3mf': '3mf', gcode: 'gcode', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', pdf: 'pdf', txt: 'text', md: 'text', csv: 'text', json: 'text', cpp: 'text', h: 'text',
};
const MIME: Record<string, string> = { stl: 'model/stl', '3mf': 'model/3mf', gcode: 'text/x-gcode', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', json: 'application/json', cpp: 'text/plain', h: 'text/plain' };
export const MAX_UPLOAD = 20 * 1024 * 1024;

export const uploadPath = (storageKey: string) => path.join(path.resolve(env().UPLOAD_DIR), storageKey);

export async function saveUpload(file: File, ownerId: string, meta: { category?: string | null; title?: string | null; allow?: string[] } = {}) {
  if (!file || typeof file.arrayBuffer !== 'function') throw bad('Choose a file to upload.');
  if (file.size > MAX_UPLOAD) throw bad('That file is over 20 MB.');
  if (file.size === 0) throw bad('That file is empty.');
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  const kind = EXT_KIND[ext];
  if (!kind) throw bad(`.${ext} files aren’t supported. Use STL, 3MF, G-code, PDF, images or text.`);
  if (meta.allow && !meta.allow.includes(kind)) throw bad(`Upload a ${meta.allow.join(' or ').toUpperCase()} file here.`);
  const buf = Buffer.from(await file.arrayBuffer());
  if (kind === 'stl') {
    // validate it parses into triangles
    const { parseStl } = await import('../printing/geometry');
    try { const m = parseStl(buf); if (m.indices.length < 3) throw new Error('no triangles'); } catch { throw bad('That STL file could not be read.'); }
  }
  if (kind === 'pdf' && buf.subarray(0, 4).toString('latin1') !== '%PDF') throw bad('That doesn’t look like a PDF.');
  const id = newId();
  const storageKey = `${id}.${ext}`;
  fs.mkdirSync(path.resolve(env().UPLOAD_DIR), { recursive: true });
  fs.writeFileSync(uploadPath(storageKey), buf);
  const safeName = file.name.replace(/[^\w.\- ()]+/g, '_').slice(0, 120);
  await db.insert(schema.uploads).values({ id, ownerId, filename: safeName, mime: MIME[ext] ?? 'application/octet-stream', size: buf.length, sha256: sha256(buf), kind, storageKey, category: meta.category ?? null, title: meta.title ?? null, createdAt: new Date() });
  return { id, filename: safeName, kind, size: buf.length };
}

export async function deleteUpload(id: string) {
  const up = await db.query.uploads.findFirst({ where: eq(schema.uploads.id, id) });
  if (!up) return;
  try { fs.unlinkSync(uploadPath(up.storageKey)); } catch { /* already gone */ }
  await db.delete(schema.knowledgeChunks).where(eq(schema.knowledgeChunks.uploadId, id));
  await db.delete(schema.uploads).where(eq(schema.uploads.id, id));
}
