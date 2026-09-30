import { z } from 'zod';

// Appendix C — response envelope (robotSpec is validated separately by normalizeSpec)
export const Envelope = z.object({
  reply: z.string().min(1).max(6000),
  intent: z.enum(['design_change', 'question', 'code_help', 'troubleshoot', 'rules', 'parts', 'print', 'chit_chat']).catch('question'),
  robotSpec: z.unknown().nullable().default(null),
  changeSummary: z.array(z.string().max(160)).max(8).catch([]).default([]),
  customParts: z.array(z.object({
    template: z.string(), name: z.string().max(40),
    params: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}),
    material: z.enum(['PLA', 'PETG', 'ABS', 'ASA', 'TPU']).catch('PLA'), color: z.string().max(20).catch('black'),
    quantity: z.number().int().min(1).max(50).catch(1), purpose: z.string().max(200).catch(''),
  })).max(4).catch([]).default([]),
  codeSuggestion: z.object({ path: z.string(), language: z.literal('cpp').catch('cpp'), code: z.string().max(20000), explanation: z.string().max(1000).catch('') }).nullable().catch(null).default(null),
  inventoryActions: z.array(z.object({ type: z.enum(['reserve', 'add_to_order']), item: z.string(), qty: z.number().int().min(1) })).max(10).catch([]).default([]),
  printActions: z.array(z.object({ partName: z.string(), qty: z.number().int().min(1).max(50) })).max(4).catch([]).default([]),
  memory: z.array(z.object({
    op: z.enum(['add', 'update', 'forget']), id: z.string().optional(),
    category: z.enum(['preference', 'skill', 'goal', 'project', 'role', 'struggle']).optional(),
    text: z.string().max(200).optional(), importance: z.number().int().min(1).max(5).optional(),
  })).max(3).catch([]).default([]),
  followUps: z.array(z.string().max(80)).max(3).catch([]).default([]),
  clarifyingQuestion: z.string().max(200).nullable().catch(null).default(null),
});
export type EnvelopeT = z.infer<typeof Envelope>;

export function parseEnvelope(raw: string): { ok: true; env: EnvelopeT } | { ok: false; error: string } {
  let text = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text);
  if (fence) text = fence[1];
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) return { ok: false, error: 'no JSON object found' };
  let json: unknown;
  try { json = JSON.parse(text.slice(start, end + 1)); } catch (e) { return { ok: false, error: `JSON.parse: ${(e as Error).message}` }; }
  const r = Envelope.safeParse(json);
  if (!r.success) return { ok: false, error: r.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  return { ok: true, env: r.data };
}

export function fallbackEnvelope(reply: string): EnvelopeT {
  return { reply: reply.slice(0, 6000) || '…', intent: 'question', robotSpec: null, changeSummary: [], customParts: [], codeSuggestion: null, inventoryActions: [], printActions: [], memory: [], followUps: [], clarifyingQuestion: null };
}
