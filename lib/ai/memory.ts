import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/client';
import { newId } from '../ids';
import { cosine, embed } from './client';

export type MemCategory = 'preference' | 'skill' | 'goal' | 'project' | 'role' | 'struggle';
const PII = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email
  /(\+?\d[\d\s().-]{7,}\d)/, // phone
  /\b\d{1,5}\s+\w+(\s\w+)*\s(street|st|avenue|ave|road|rd|blvd|lane|ln|drive|dr)\b/i, // address
  /\b(password|passcode|pin code)\b/i,
  /\b(birthday|born on|date of birth|dob)\b/i,
  /\b(diagnos|medication|therapy|disorder|illness|allerg|adhd|autism|depress|anxiety)\w*/i,
  /\b(mom|dad|mother|father|sister|brother|parent|family|girlfriend|boyfriend)\b/i,
  /\b(i live|my address|my house)\b/i,
];

export function memoryProblem(text: string): string | null {
  const t = text.trim();
  if (t.length < 5 || t.length > 200) return 'Memories must be 5–200 characters.';
  if (PII.some((r) => r.test(t))) return 'That looks like personal information, which the mentor does not store.';
  return null;
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
function jaccard(a: string, b: string) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let i = 0;
  for (const w of A) if (B.has(w)) i++;
  return i / (A.size + B.size - i);
}
const toBuf = (f: Float32Array) => Buffer.from(f.buffer, f.byteOffset, f.byteLength);
const fromBuf = (b: Buffer | null) => (b ? new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)) : null);

export async function listMemories(userId: string) {
  return db.select({ id: schema.memories.id, category: schema.memories.category, text: schema.memories.text, importance: schema.memories.importance, pinned: schema.memories.pinned, createdAt: schema.memories.createdAt, updatedAt: schema.memories.updatedAt, lastUsedAt: schema.memories.lastUsedAt })
    .from(schema.memories).where(eq(schema.memories.userId, userId)).orderBy(desc(schema.memories.pinned), desc(schema.memories.updatedAt));
}

/** add (with dedupe ≥0.88 cosine, or ≥0.75 keyword overlap without embeddings) — returns the memory id */
export async function addMemory(userId: string, m: { category: MemCategory; text: string; importance?: number; sourceMessageId?: string }): Promise<{ id: string; updated: boolean } | { error: string }> {
  const problem = memoryProblem(m.text);
  if (problem) return { error: problem };
  const existing = await db.select().from(schema.memories).where(eq(schema.memories.userId, userId));
  const emb = (await embed([m.text]))?.[0] ?? null;
  let dup: (typeof existing)[number] | undefined;
  for (const e of existing) {
    const ev = fromBuf(e.embedding);
    const sim = emb && ev ? cosine(emb, ev) : jaccard(e.text, m.text);
    if (sim >= (emb && ev ? 0.88 : 0.75)) { dup = e; break; }
  }
  const now = new Date();
  if (dup) {
    await db.update(schema.memories).set({ text: m.text.trim(), category: m.category, importance: m.importance ?? dup.importance, embedding: emb ? toBuf(emb) : dup.embedding, updatedAt: now }).where(eq(schema.memories.id, dup.id));
    return { id: dup.id, updated: true };
  }
  if (existing.length >= 200) {
    const evict = [...existing].filter((e) => !e.pinned).sort((a, b) => a.importance - b.importance || (a.lastUsedAt?.getTime() ?? 0) - (b.lastUsedAt?.getTime() ?? 0))[0];
    if (evict) await db.delete(schema.memories).where(eq(schema.memories.id, evict.id));
  }
  const id = newId();
  await db.insert(schema.memories).values({ id, userId, category: m.category, text: m.text.trim(), importance: m.importance ?? 3, embedding: emb ? toBuf(emb) : null, sourceMessageId: m.sourceMessageId ?? null, createdAt: now, updatedAt: now });
  return { id, updated: false };
}

/** pinned (≤5) + top 6 relevant to the message (cosine ≥0.25, or keyword overlap) */
export async function retrieveMemories(userId: string, message: string) {
  const all = await db.select().from(schema.memories).where(eq(schema.memories.userId, userId));
  if (!all.length) return [];
  const pinned = all.filter((m) => m.pinned).slice(0, 5);
  const rest = all.filter((m) => !m.pinned);
  const q = /remember|about me|know about/i.test(message);
  let ranked: typeof rest;
  if (q) ranked = [...rest].sort((a, b) => b.importance - a.importance);
  else {
    const emb = rest.some((m) => m.embedding) ? (await embed([message]))?.[0] ?? null : null;
    const scored = rest.map((m) => {
      const ev = fromBuf(m.embedding);
      return { m, s: emb && ev ? cosine(emb, ev) : jaccard(m.text, message) + m.importance * 0.02 };
    });
    ranked = scored.filter((x) => x.s >= (emb ? 0.25 : 0.04)).sort((a, b) => b.s - a.s).map((x) => x.m);
    if (ranked.length < 3) ranked = [...ranked, ...rest.filter((m) => !ranked.includes(m)).sort((a, b) => b.importance - a.importance)].slice(0, 3);
  }
  const chosen = [...pinned, ...ranked.slice(0, 6)].slice(0, 12);
  if (chosen.length) await db.update(schema.memories).set({ lastUsedAt: new Date() }).where(inArray(schema.memories.id, chosen.map((m) => m.id)));
  return chosen.map((m) => ({ id: m.id, category: m.category, text: m.text }));
}

export async function forgetMemory(userId: string, id: string) {
  await db.delete(schema.memories).where(and(eq(schema.memories.id, id), eq(schema.memories.userId, userId)));
}

/** best match for a "forget …" op without an id */
export async function findMemory(userId: string, text: string) {
  const all = await db.select().from(schema.memories).where(eq(schema.memories.userId, userId));
  let best: (typeof all)[number] | null = null, bs = 0;
  for (const m of all) { const s = jaccard(m.text, text); if (s > bs) { bs = s; best = m; } }
  return bs >= 0.2 ? best : null;
}
