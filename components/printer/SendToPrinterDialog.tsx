'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileArrowUp, Warning } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { useUI } from '@/lib/client/stores';
import { Dialog } from '../ui/Dialog';
import { Badge, Field, Spinner } from '../ui/bits';
import { toast } from '../ui/Toast';

export interface PrintSources {
  parts: { id: string; name: string; buildId: string; buildName: string; template: string; material: string; color: string; defaultQty: number; legality: { key: string; label: string; tone: 'grey' | 'blue' | 'purple' } }[];
  uploads: { id: string; filename: string; size: number; createdAt: number }[];
}
export interface PrinterView { id: string; name: string; model: string; adapter: string; materials: string[]; online: boolean; state: string; bedMm: [number, number, number]; simFrozen: boolean; throughputGPerMin: number; baseUrl: string | null; hasApiKey: boolean; lastSeenAt: number | null; temps: { nozzle?: number; bed?: number } | null; job: null | { id: string; name: string; material: string; color: string; progress: number; remainingSec: number } }
interface Estimate { massG: number; totalG: number; timeSec: number; sizeMm: number[]; fits: boolean; bed: number[]; legality: { key: string; label: string; tone: 'grey' | 'blue' | 'purple' } }

export const MATERIALS = ['PLA', 'PETG', 'ABS', 'ASA', 'TPU'];
export const COLORS: [string, string][] = [['black', '#2C2F33'], ['red', '#C8102E'], ['white', '#E8EAED'], ['gray', '#8A9097'], ['blue', '#1F6FD1'], ['green', '#1FA84F'], ['orange', '#EA8111'], ['yellow', '#F2C200'], ['purple', '#643DBC']];
export const LAYERS = [0.12, 0.16, 0.2, 0.28];

export function usePrinters() {
  return useQuery({ queryKey: ['printers'], queryFn: () => api.get<{ status: string; printers: PrinterView[] }>('/api/printers'), refetchInterval: 10_000 });
}
export function fmtDuration(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function SendToPrinterDialog() {
  const { sendToPrinter: st, closeSendToPrinter } = useUI();
  const qc = useQueryClient();
  const sources = useQuery({ queryKey: ['print-sources'], queryFn: () => api.get<PrintSources>('/api/print/sources'), enabled: st.open });
  const printers = usePrinters();
  const [src, setSrc] = useState<'part' | 'upload'>('part');
  const [partId, setPartId] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [material, setMaterial] = useState('PLA');
  const [color, setColor] = useState('black');
  const [layer, setLayer] = useState(0.2);
  const [infill, setInfill] = useState(20);
  const [qty, setQty] = useState(1);
  const [printerId, setPrinterId] = useState('');
  const [notes, setNotes] = useState('');
  const [est, setEst] = useState<Estimate | null>(null);
  const [estErr, setEstErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!st.open) return;
    setSrc(st.uploadId ? 'upload' : 'part'); setPartId(st.partId ?? ''); setUploadId(st.uploadId ?? ''); setQty(st.qty ?? 1); setPrinterId(''); setNotes(''); setEst(null); setEstErr(null); setBusy(false);
  }, [st.open, st.partId, st.buildId, st.qty, st.uploadId]);
  useEffect(() => {
    if (!st.open || !sources.data || st.uploadId) return;
    const list = sources.data.parts.filter((p) => !st.buildId || p.buildId === st.buildId);
    const chosen = sources.data.parts.find((p) => p.id === partId) ?? (!partId ? list[0] ?? sources.data.parts[0] : undefined);
    if (chosen && chosen.id !== partId) setPartId(chosen.id);
    if (chosen) { setMaterial(chosen.material); setColor(chosen.color); if (!st.qty) setQty(chosen.defaultQty); }
    if (!chosen && sources.data.parts.length === 0) setSrc('upload');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.open, sources.data, partId]);

  const sourceBody = src === 'part' ? { customPartId: partId || null } : { uploadId: uploadId || null };
  const ready = src === 'part' ? !!partId : !!uploadId;

  useEffect(() => {
    if (!st.open || !ready) { setEst(null); return; }
    let live = true;
    const t = setTimeout(async () => {
      try { const e = await api.post<Estimate>('/api/print/estimate', { ...sourceBody, material, infillPct: infill, layerHeightMm: layer, quantity: qty, printerId: printerId || null }); if (live) { setEst(e); setEstErr(null); } }
      catch (e) { if (live) { setEst(null); setEstErr((e as ClientError).message); } }
    }, 250);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.open, ready, src, partId, uploadId, material, infill, layer, qty, printerId]);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast.error('That file is over 20 MB'); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', f); fd.append('allow', 'stl');
      const r = await api.upload<{ id: string }>('/api/uploads', fd);
      setUploadId(r.id); qc.invalidateQueries({ queryKey: ['print-sources'] });
    } catch (e) { toast.error('Upload failed', (e as ClientError).message); }
    finally { setUploading(false); }
  };

  const queue = async () => {
    setBusy(true);
    try {
      await api.post('/api/print/jobs', { ...sourceBody, material, color, layerHeightMm: layer, infillPct: infill, quantity: qty, printerId: printerId || null, notes: notes || undefined });
      qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['jobs'] }); qc.invalidateQueries({ queryKey: ['printers'] });
      toast.ok('Queued for printing', printerId ? undefined : 'It starts on the first idle printer with that material.');
      closeSendToPrinter();
    } catch (e) { toast.error('Could not queue the print', (e as ClientError).message); setBusy(false); }
  };

  const part = sources.data?.parts.find((p) => p.id === partId);
  const eligible = (printers.data?.printers ?? []).filter((p) => p.materials.includes(material));
  const footer = (
    <>
      <button className="btn btn-outline" onClick={closeSendToPrinter}>Cancel</button>
      <button className="btn btn-primary" disabled={!ready || busy || !est?.fits} onClick={queue}>{busy ? <Spinner /> : null}Queue print</button>
    </>
  );

  return (
    <Dialog open={st.open} onOpenChange={(o) => (o ? null : closeSendToPrinter())} title="Send to Printer" description="Pick a part, choose settings, and add it to the queue." width={600} footer={footer}>
      <div className="grid gap-4">
        <div className="flex gap-1 rounded-[8px] bg-[#F2F4F5] p-1" role="tablist">
          {([['part', 'Printed part'], ['upload', 'Upload an STL']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={src === k} onClick={() => setSrc(k)} className={`flex-1 rounded-[6px] py-1.5 text-[13px] font-semibold ${src === k ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900'}`}>{l}</button>
          ))}
        </div>

        {src === 'part' ? (
          sources.isLoading ? <div className="flex items-center gap-2 text-[13px] text-ink-500"><Spinner />Loading parts…</div> : (
            <div className="grid grid-cols-[88px_1fr] items-start gap-3">
              {partId ? <img src={`/api/parts/${partId}/thumb.png?color=${color}`} alt="" className="h-[66px] w-[88px] rounded-[6px] bg-[#F4F6F8] object-contain" /> : <div className="h-[66px] w-[88px] rounded-[6px] bg-[#F4F6F8]" />}
              <Field label="Part">
                <select className="input" value={partId} onChange={(e) => setPartId(e.target.value)}>
                  {!sources.data?.parts.length && <option value="">No printed parts yet — add one in a build’s Printed Parts tab</option>}
                  {Object.entries((sources.data?.parts ?? []).reduce<Record<string, PrintSources['parts']>>((m, p) => ((m[p.buildName] ??= []).push(p), m), {})).map(([b, ps]) => (
                    <optgroup key={b} label={b}>{ps.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.template}</option>)}</optgroup>
                  ))}
                </select>
              </Field>
            </div>
          )
        ) : (
          <div>
            <input ref={fileRef} type="file" accept=".stl,model/stl" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
              className="flex w-full flex-col items-center gap-2 rounded-[8px] border-2 border-dashed border-line px-4 py-6 text-[13px] text-ink-500 hover:border-ink-300">
              {uploading ? <Spinner /> : <FileArrowUp size={26} />}
              {uploadId ? <span className="font-semibold text-ink-900">{sources.data?.uploads.find((u) => u.id === uploadId)?.filename ?? 'Uploaded'}</span> : 'Drop an STL (up to 20 MB) or click to choose'}
            </button>
            {!!sources.data?.uploads.length && (
              <Field label="…or pick a recent upload">
                <select className="input" value={uploadId} onChange={(e) => setUploadId(e.target.value)}>
                  <option value="">Choose a file</option>
                  {sources.data.uploads.map((u) => <option key={u.id} value={u.id}>{u.filename}</option>)}
                </select>
              </Field>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Material"><select className="input" value={material} onChange={(e) => setMaterial(e.target.value)}>{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Layer height"><select className="input" value={layer} onChange={(e) => setLayer(Number(e.target.value))}>{LAYERS.map((l) => <option key={l} value={l}>{l.toFixed(2)} mm</option>)}</select></Field>
          <Field label="Quantity"><input className="input" type="number" min={1} max={50} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} /></Field>
        </div>
        <div>
          <div className="label mb-1.5">Color</div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map(([n, hex]) => <button key={n} aria-label={n} aria-pressed={color === n} onClick={() => setColor(n)} className={`h-7 w-7 rounded-full border-2 ${color === n ? 'border-fdr-red ring-2 ring-fdr-red/30' : 'border-white ring-1 ring-line'}`} style={{ background: hex }} />)}
          </div>
        </div>
        <div>
          <div className="label mb-1.5 flex justify-between"><span>Infill</span><span className="tabular text-ink-900">{infill}%</span></div>
          <input type="range" min={10} max={100} step={5} value={infill} onChange={(e) => setInfill(Number(e.target.value))} className="w-full accent-[#C8061C]" aria-label="Infill percent" />
        </div>
        <Field label="Printer">
          <select className="input" value={printerId} onChange={(e) => setPrinterId(e.target.value)}>
            <option value="">Auto — first idle printer with {material}</option>
            {eligible.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.state}{p.adapter === 'simulated' ? ' (simulated)' : ''}</option>)}
          </select>
        </Field>
        {!eligible.length && printers.data && <div className="flex items-center gap-2 text-[12.5px] text-[#9A6B00]"><Warning size={16} />No printer is loaded with {material}. It will wait in the queue.</div>}
        <Field label="Notes (optional)"><input className="input" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. print with brim" /></Field>

        <div className="rounded-[8px] bg-[#F6F7F9] px-4 py-3">
          {estErr ? <div className="text-[13px] text-fdr-red">{estErr}</div> : !est ? <div className="text-[13px] text-ink-500">{ready ? 'Estimating…' : 'Choose a part to see the estimate.'}</div> : (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Time (est.)</div><div className="tabular text-[16px] font-bold text-ink-900">{fmtDuration(est.timeSec)}</div></div>
              <div><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Filament (est.)</div><div className="tabular text-[16px] font-bold text-ink-900">{est.totalG} g</div></div>
              <div><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Size</div><div className="tabular text-[13px] font-semibold text-ink-900">{est.sizeMm.map((s) => Math.round(s)).join(' × ')} mm</div></div>
              <Badge tone={(part?.legality ?? est.legality).tone}>{(part?.legality ?? est.legality).label}</Badge>
              {!est.fits && <div className="w-full text-[12.5px] text-fdr-red">Too big for the printer bed ({est.bed.join(' × ')} mm).</div>}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
