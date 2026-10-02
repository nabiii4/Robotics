import { route, bad } from '@/lib/api';
import { importAll } from '@/lib/services/dataExport';
import { clearDerivedCache } from '@/lib/services/builds';

export const runtime = 'nodejs';
export const maxDuration = 120;

export const POST = route({ role: 'admin' }, async ({ req }) => {
  const text = await req.text();
  if (text.length > 50_000_000) throw bad('That file is too large.');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw bad('That file isn’t valid JSON.'); }
  const counts = await importAll(data);
  clearDerivedCache();
  return { ok: true, counts };
});
