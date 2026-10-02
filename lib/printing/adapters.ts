import { decrypt } from '../crypto';

export interface RemoteStatus { state: 'idle' | 'printing' | 'paused' | 'error'; progress?: number; remainingSec?: number; temps?: { nozzle?: number; bed?: number } }
type PrinterLike = { adapter: string; baseUrl: string | null; apiKeyEnc: string | null };

async function j(url: string, init: RequestInit = {}, timeoutMs = 4000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: ac.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(t);
  }
}
const base = (p: PrinterLike) => (p.baseUrl ?? '').replace(/\/$/, '');

// ---- OctoPrint (X-Api-Key) ----
export async function octoprintStatus(p: PrinterLike): Promise<RemoteStatus> {
  const h = { 'X-Api-Key': decrypt(p.apiKeyEnc) };
  const [printer, job] = await Promise.all([j(`${base(p)}/api/printer`, { headers: h }).catch(() => ({})), j(`${base(p)}/api/job`, { headers: h })]);
  const st = String(job?.state ?? '').toLowerCase();
  return {
    state: st.includes('printing') ? 'printing' : st.includes('paus') ? 'paused' : st.includes('error') ? 'error' : 'idle',
    progress: job?.progress?.completion != null ? job.progress.completion / 100 : undefined,
    remainingSec: job?.progress?.printTimeLeft ?? undefined,
    temps: { nozzle: printer?.temperature?.tool0?.actual, bed: printer?.temperature?.bed?.actual },
  };
}
export async function octoprintCommand(p: PrinterLike, cmd: 'pause' | 'resume' | 'cancel') {
  const body = cmd === 'cancel' ? { command: 'cancel' } : { command: 'pause', action: cmd };
  await j(`${base(p)}/api/job`, { method: 'POST', headers: { 'X-Api-Key': decrypt(p.apiKeyEnc), 'content-type': 'application/json' }, body: JSON.stringify(body) });
}
export async function octoprintUpload(p: PrinterLike, filename: string, data: Buffer) {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(data)]), filename);
  fd.append('print', 'true');
  await j(`${base(p)}/api/files/local`, { method: 'POST', headers: { 'X-Api-Key': decrypt(p.apiKeyEnc) }, body: fd }, 30000);
}

// ---- Moonraker (Klipper) ----
export async function moonrakerStatus(p: PrinterLike): Promise<RemoteStatus> {
  const r = await j(`${base(p)}/printer/objects/query?print_stats&virtual_sdcard&extruder&heater_bed`);
  const s = r?.result?.status ?? {};
  const st = String(s.print_stats?.state ?? '').toLowerCase();
  return {
    state: st === 'printing' ? 'printing' : st === 'paused' ? 'paused' : st === 'error' ? 'error' : 'idle',
    progress: s.virtual_sdcard?.progress,
    temps: { nozzle: s.extruder?.temperature, bed: s.heater_bed?.temperature },
  };
}
export async function moonrakerCommand(p: PrinterLike, cmd: 'pause' | 'resume' | 'cancel') {
  await j(`${base(p)}/printer/print/${cmd}`, { method: 'POST' });
}
export async function moonrakerUpload(p: PrinterLike, filename: string, data: Buffer) {
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(data)]), filename);
  fd.append('print', 'true');
  await j(`${base(p)}/server/files/upload`, { method: 'POST', body: fd }, 30000);
}

export async function testPrinter(p: PrinterLike): Promise<{ ok: boolean; message: string }> {
  if (p.adapter === 'simulated') return { ok: true, message: 'Simulated printer — always online.' };
  try {
    const s = p.adapter === 'octoprint' ? await octoprintStatus(p) : await moonrakerStatus(p);
    return { ok: true, message: `Connected: ${s.state}${s.temps?.nozzle != null ? `, nozzle ${Math.round(s.temps.nozzle)}°C` : ''}` };
  } catch (e) {
    return { ok: false, message: `Could not reach the printer (${(e as Error).message}).` };
  }
}
