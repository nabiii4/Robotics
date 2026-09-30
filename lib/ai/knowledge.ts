import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { env } from '../env';
import { cosine, embed } from './client';

const RULE_RE = /<([A-Z]{1,4}\d{1,2}[a-z]?)>/g;

export async function extractText(uploadId: string): Promise<{ page: number; text: string }[]> {
  const up = await db.query.uploads.findFirst({ where: eq(schema.uploads.id, uploadId) });
  if (!up) return [];
  const buf = fs.readFileSync(path.join(path.resolve(env().UPLOAD_DIR), up.storageKey));
  if (up.kind === 'pdf') {
    const { extractText: ex, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await ex(pdf, { mergePages: false });
    return (text as string[]).map((t, i) => ({ page: i + 1, text: t }));
  }
  return [{ page: 1, text: buf.toString('utf8') }];
}

/** chunk ≈700 tokens (~2800 chars) with ~80 token overlap, preferring rule headers as split points */
export function chunk(pages: { page: number; text: string }[]) {
  const out: { page: number; text: string; ruleIds: string[] }[] = [];
  const SIZE = 2800, OVER = 320;
  for (const p of pages) {
    const t = p.text.replace(/\s+\n/g, '\n').trim();
    let i = 0;
    while (i < t.length) {
      let end = Math.min(t.length, i + SIZE);
      if (end < t.length) {
        const slice = t.slice(i + SIZE / 2, end);
        const m = slice.lastIndexOf('<');
        if (m > 0) end = i + SIZE / 2 + m;
      }
      const text = t.slice(i, end).trim();
      if (text.length > 40) out.push({ page: p.page, text, ruleIds: [...new Set([...text.matchAll(RULE_RE)].map((x) => x[1]))] });
      if (end >= t.length) break;
      i = Math.max(i + 1, end - OVER);
    }
  }
  return out;
}

export async function indexUpload(uploadId: string) {
  await db.delete(schema.knowledgeChunks).where(eq(schema.knowledgeChunks.uploadId, uploadId));
  const chunks = chunk(await extractText(uploadId));
  for (let i = 0; i < chunks.length; i += 16) {
    const batch = chunks.slice(i, i + 16);
    const embs = await embed(batch.map((c) => c.text));
    for (let k = 0; k < batch.length; k++) {
      const e = embs?.[k];
      await db.insert(schema.knowledgeChunks).values({ id: newId(), uploadId, idx: i + k, text: batch[k].text, page: batch[k].page, ruleIds: batch[k].ruleIds, embedding: e ? Buffer.from(e.buffer) : null });
    }
  }
  return chunks.length;
}

const terms = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/** top 4 excerpts (cosine ≥0.3 or keyword score) plus exact rule-ID matches */
export async function searchKnowledge(query: string, k = 4) {
  const enabled = await db.select({ id: schema.uploads.id }).from(schema.uploads).where(eq(schema.uploads.useForAi, true));
  if (!enabled.length) return [];
  const rows = await db.select().from(schema.knowledgeChunks).where(inArray(schema.knowledgeChunks.uploadId, enabled.map((u) => u.id)));
  if (!rows.length) return [];
  const named = [...query.matchAll(/\b([A-Z]{1,4}\d{1,2}[a-z]?)\b/g)].map((m) => m[1].toUpperCase());
  const exact = rows.filter((r) => r.ruleIds.some((id) => named.includes(id.toUpperCase())));
  const q = terms(query);
  const qe = rows.some((r) => r.embedding) ? (await embed([query]))?.[0] ?? null : null;
  const scored = rows.map((r) => {
    if (qe && r.embedding) return { r, s: cosine(qe, new Float32Array(r.embedding.buffer.slice(r.embedding.byteOffset, r.embedding.byteOffset + r.embedding.byteLength))) };
    const t = r.text.toLowerCase();
    const s = q.reduce((acc, w) => acc + (t.includes(w) ? 1 : 0), 0) / Math.max(1, q.length);
    return { r, s: s * 0.6 };
  }).filter((x) => x.s >= 0.3).sort((a, b) => b.s - a.s).map((x) => x.r);
  const out = [...exact, ...scored.filter((r) => !exact.includes(r))].slice(0, k);
  return out.map((r) => ({ ruleIds: r.ruleIds, page: r.page, text: r.text.slice(0, 1600) }));
}
