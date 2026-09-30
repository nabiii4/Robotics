import 'server-only';
import { env } from '../env';

export interface Target { name: string; kind: 'azure' | 'openai'; endpoint: string; key: string; model: string }

export function aiTargets(): Target[] {
  const e = env();
  const t: Target[] = [];
  if (e.AZURE_OPENAI_ENDPOINT && e.AZURE_OPENAI_API_KEY && e.AZURE_OPENAI_DEPLOYMENT) t.push({ name: 'primary', kind: 'azure', endpoint: e.AZURE_OPENAI_ENDPOINT, key: e.AZURE_OPENAI_API_KEY, model: e.AZURE_OPENAI_DEPLOYMENT });
  if (e.AZURE_OPENAI_ENDPOINT && e.AZURE_OPENAI_API_KEY && e.AZURE_OPENAI_FALLBACK_DEPLOYMENT) t.push({ name: 'primary-fallback', kind: 'azure', endpoint: e.AZURE_OPENAI_ENDPOINT, key: e.AZURE_OPENAI_API_KEY, model: e.AZURE_OPENAI_FALLBACK_DEPLOYMENT });
  if (e.AZURE_OPENAI_BACKUP_ENDPOINT && e.AZURE_OPENAI_BACKUP_API_KEY && e.AZURE_OPENAI_BACKUP_DEPLOYMENT) t.push({ name: 'backup', kind: 'azure', endpoint: e.AZURE_OPENAI_BACKUP_ENDPOINT, key: e.AZURE_OPENAI_BACKUP_API_KEY, model: e.AZURE_OPENAI_BACKUP_DEPLOYMENT });
  if (e.OPENAI_API_KEY) t.push({ name: 'openai', kind: 'openai', endpoint: e.OPENAI_BASE_URL, key: e.OPENAI_API_KEY, model: e.OPENAI_MODEL });
  return t;
}

/** demo mode = built-in mentor fixtures (AI_MOCK=1, or AI_MOCK=auto with no keys) */
export function aiMode() {
  const m = env().AI_MOCK.toLowerCase();
  const targets = aiTargets();
  const demo = m === '1' || m === 'true' || ((m === 'auto' || m === '') && targets.length === 0);
  return { configured: targets.length > 0, demo, targets: targets.map((t) => `${t.name} (${t.model})`) };
}
