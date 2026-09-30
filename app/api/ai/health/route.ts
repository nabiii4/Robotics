import { route } from '@/lib/api';
import { callModel, targetHealth } from '@/lib/ai/client';
import { aiMode } from '@/lib/ai/config';

export const runtime = 'nodejs';
export const maxDuration = 90;
export const GET = route({ role: 'admin' }, async ({ req }) => {
  const mode = aiMode();
  if (req.nextUrl.searchParams.get('ping') === '1' && mode.configured) {
    try { await callModel([{ role: 'system', content: 'Reply with JSON {"ok": true}.' }, { role: 'user', content: 'ping' }], 'summarize'); } catch { /* health below records the failure */ }
  }
  return { mode, targets: targetHealth() };
});
