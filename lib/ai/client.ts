import 'server-only';
import { aiTargets, type Target } from './config';
import { env } from '../env';

export type Mode = 'chat' | 'design' | 'create' | 'repair' | 'summarize';
export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }
export interface CallResult { content: string; target: string; model: string; tokensIn: number; tokensOut: number; reasoningTokens: number; latencyMs: number }

export class AiError extends Error {
  constructor(public kind: 'unconfigured' | 'filtered' | 'unavailable', message: string) { super(message); }
}

const BUDGET: Record<Mode, { effort: string; tokens: number }> = {
  chat: { effort: 'low', tokens: 3000 },
  design: { effort: 'low', tokens: 9000 },
  create: { effort: 'medium', tokens: 12000 },
  repair: { effort: 'low', tokens: 6000 },
  summarize: { effort: 'minimal', tokens: 1200 },
};

// per-target health (in memory; shown in Settings → AI & Usage)
interface Health { unhealthyUntil?: number; coolingUntil?: number; dropped: Map<string, number>; apiVersion?: string; lastError?: string; lastOkAt?: number; lastLatency?: number }
const health = new Map<string, Health>();
const h = (t: Target) => { let x = health.get(t.name); if (!x) { x = { dropped: new Map() }; health.set(t.name, x); } return x; };
export function targetHealth() {
  return aiTargets().map((t) => {
    const x = h(t);
    const now = Date.now();
    return {
      name: t.name, kind: t.kind, model: t.model,
      status: x.unhealthyUntil && x.unhealthyUntil > now ? 'unhealthy' : x.coolingUntil && x.coolingUntil > now ? 'cooling' : x.lastOkAt ? 'healthy' : 'unknown',
      apiVersion: x.apiVersion ?? null, dropped: [...x.dropped.entries()].filter(([, until]) => until > now).map(([k]) => k), lastError: x.lastError ?? null, lastLatency: x.lastLatency ?? null,
    };
  });
}

const API_VERSIONS = () => [...new Set([env().AZURE_OPENAI_API_VERSION || '2025-01-01-preview', '2025-04-01-preview', '2024-10-21'])];
const lowerEffort = (model: string) => (/5\.4/.test(model) ? 'none' : 'minimal');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function effortFor(model: string, e: string) {
  // gpt-5.4-*: none|low|medium|high|xhigh ; gpt-5-*: minimal|low|medium|high
  if (/5\.4/.test(model) && e === 'minimal') return 'none';
  if (!/5\.4/.test(model) && e === 'none') return 'minimal';
  return e;
}

async function attempt(t: Target, messages: ChatMsg[], tokens: number, effort: string, apiVersion: string, signal?: AbortSignal) {
  const x = h(t);
  const now = Date.now();
  const drop = (k: string) => (x.dropped.get(k) ?? 0) > now;
  const body: Record<string, unknown> = { messages };
  if (drop('max_completion_tokens')) body.max_tokens = Math.min(tokens, 4096); else body.max_completion_tokens = tokens;
  if (!drop('reasoning_effort')) body.reasoning_effort = effortFor(t.model, effort);
  if (!drop('response_format')) body.response_format = { type: 'json_object' };
  let url: string, headers: Record<string, string>;
  if (t.kind === 'azure') {
    url = `${t.endpoint.replace(/\/$/, '')}/openai/deployments/${encodeURIComponent(t.model)}/chat/completions?api-version=${apiVersion}`;
    headers = { 'api-key': t.key, 'content-type': 'application/json' };
  } else {
    url = `${t.endpoint.replace(/\/$/, '')}/chat/completions`;
    headers = { authorization: `Bearer ${t.key}`, 'content-type': 'application/json' };
    body.model = t.model;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 60_000);
  const onAbort = () => ac.abort();
  signal?.addEventListener('abort', onAbort);
  const started = Date.now();
  try {
    const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: ac.signal });
    const text = await r.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { /* non-json error */ }
    return { status: r.status, data, text, retryAfter: Number(r.headers.get('retry-after') ?? 0), latency: Date.now() - started };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Call the configured targets in order with the spec §12.2 failover policy. */
export async function callModel(messages: ChatMsg[], mode: Mode, signal?: AbortSignal): Promise<CallResult> {
  const targets = aiTargets();
  if (!targets.length) throw new AiError('unconfigured', 'AI is not configured.');
  const budget = BUDGET[mode];
  let lastErr = 'no target answered';
  for (const t of targets) {
    const x = h(t);
    const now = Date.now();
    if ((x.unhealthyUntil ?? 0) > now || (x.coolingUntil ?? 0) > now) continue;
    let tokens = budget.tokens;
    let effort = budget.effort;
    let lengthRetried = false, paramRetries = 0, rateRetried = false;
    const versions = t.kind === 'azure' ? (x.apiVersion ? [x.apiVersion] : API_VERSIONS()) : ['v1'];
    let vi = 0;
    while (true) {
      if (signal?.aborted) throw new AiError('unavailable', 'Stopped.');
      let res;
      try { res = await attempt(t, messages, tokens, effort, versions[vi], signal); }
      catch (e) { lastErr = (e as Error).name === 'AbortError' ? 'timeout' : (e as Error).message; x.lastError = lastErr; break; }
      const { status, data, text } = res;
      const errMsg = String((data.error as { message?: string; code?: string } | undefined)?.message ?? text ?? '').slice(0, 400);
      const errCode = String((data.error as { code?: string } | undefined)?.code ?? '');
      if (status === 200) {
        const choice = (data.choices as { message?: { content?: string }; finish_reason?: string }[] | undefined)?.[0];
        const content = choice?.message?.content ?? '';
        const finish = choice?.finish_reason ?? '';
        if (finish === 'content_filter') throw new AiError('filtered', 'filtered');
        if (finish === 'length' && !content) {
          if (lengthRetried) { lastErr = 'empty reply (length)'; break; }
          lengthRetried = true; tokens = Math.min(16000, tokens * 2); effort = lowerEffort(t.model); continue;
        }
        if (!content) { lastErr = 'empty reply'; break; }
        if (t.kind === 'azure') x.apiVersion = versions[vi];
        x.lastOkAt = Date.now(); x.lastLatency = res.latency; x.lastError = undefined;
        const usage = (data.usage ?? {}) as { prompt_tokens?: number; completion_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
        return { content, target: t.name, model: String(data.model ?? t.model), tokensIn: usage.prompt_tokens ?? 0, tokensOut: usage.completion_tokens ?? 0, reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? 0, latencyMs: res.latency };
      }
      if (status === 400) {
        if (/content.?filter|ResponsibleAIPolicyViolation/i.test(errMsg + errCode)) throw new AiError('filtered', 'filtered');
        if (t.kind === 'azure' && /api.?version/i.test(errMsg) && vi < versions.length - 1) { vi++; continue; }
        const param = ['reasoning_effort', 'response_format', 'max_completion_tokens', 'temperature'].find((p) => errMsg.includes(p));
        if (param && paramRetries < 3) { x.dropped.set(param, Date.now() + 3_600_000); paramRetries++; continue; }
        lastErr = `400: ${errMsg}`; x.lastError = lastErr; break;
      }
      if (status === 429) {
        const ra = res.retryAfter || 30;
        if (ra <= 5 && !rateRetried) { rateRetried = true; await sleep(ra * 1000); continue; }
        x.coolingUntil = Date.now() + ra * 1000; lastErr = 'rate limited'; x.lastError = lastErr; break;
      }
      if (status === 401 || status === 403 || status === 404) {
        if (status === 404 && t.kind === 'azure' && /api.?version/i.test(errMsg) && vi < versions.length - 1) { vi++; continue; }
        x.unhealthyUntil = Date.now() + 600_000; lastErr = `${status}: ${errMsg}`; x.lastError = lastErr; break;
      }
      lastErr = `${status}: ${errMsg}`; x.lastError = lastErr; break; // 5xx etc → next target
    }
  }
  throw new AiError('unavailable', lastErr);
}

/** Embeddings (optional): Azure first, then OpenAI; null when unavailable. */
export async function embed(texts: string[]): Promise<Float32Array[] | null> {
  const e = env();
  try {
    if (e.AZURE_OPENAI_EMBEDDING_MODEL && e.AZURE_OPENAI_ENDPOINT && e.AZURE_OPENAI_API_KEY) {
      const r = await fetch(`${e.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/deployments/${e.AZURE_OPENAI_EMBEDDING_MODEL}/embeddings?api-version=${e.AZURE_OPENAI_EMBEDDING_API_VERSION}`, { method: 'POST', headers: { 'api-key': e.AZURE_OPENAI_API_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ input: texts.slice(0, 16) }) });
      if (r.ok) { const d = await r.json(); return d.data.map((x: { embedding: number[] }) => Float32Array.from(x.embedding)); }
    }
    if (e.OPENAI_EMBEDDING_MODEL && e.OPENAI_API_KEY) {
      const r = await fetch(`${e.OPENAI_BASE_URL.replace(/\/$/, '')}/embeddings`, { method: 'POST', headers: { authorization: `Bearer ${e.OPENAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ input: texts.slice(0, 16), model: e.OPENAI_EMBEDDING_MODEL }) });
      if (r.ok) { const d = await r.json(); return d.data.map((x: { embedding: number[] }) => Float32Array.from(x.embedding)); }
    }
  } catch { /* fall back to keyword search */ }
  return null;
}

export function cosine(a: Float32Array, b: Float32Array) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
