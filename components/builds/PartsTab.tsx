'use client';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, DownloadSimple, FileArrowUp, Info, Plus, Printer, Trash } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { useUI } from '@/lib/client/stores';
import { TEMPLATE_DEFS, TEMPLATE_BY_ID, LEGALITY_BADGE, type ParamValue } from '@/lib/printing/templates';
import { Badge, EmptyState, Field, Spinner } from '../ui/bits';
import { Dialog } from '../ui/Dialog';
import { Switch } from '../ui/Switch';
import { toast } from '../ui/Toast';
import { COLORS, MATERIALS, fmtDuration } from '../printer/SendToPrinterDialog';

const MeshViewer = dynamic(() => import('../viewer3d/MeshViewer'), { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-[#F4F6F8] text-[12px] text-ink-400">Loading preview…</div> });

export interface PartView {
  id: string; buildId: string; name: string; template: string; templateName: string; params: Record<string, ParamValue>; describe: string; material: string; color: string; defaultQty: number;
  purpose: string | null; legality: string; legalityBadge: { label: string; tone: 'grey' | 'blue' | 'purple' }; uploadId: string | null; filename: string | null; updatedAt: number;
  defaultPrint: { material: string; layerHeightMm: number; infillPct: number; walls: number; supports: boolean; orientation: string } | null;
}
interface Preview { positions: number[]; indices: number[]; describe: string; estimate: { massG: number; timeSec: number }; bbox: { min: number[]; max: number[] } }

const BANNER = 'In V5RC, 3D‑printed parts may only be non‑functional decorations or custom license plates (see the current Game Manual and Q&A). Use printed parts for practice robots, prototypes, tools, jigs, and VEX U / VEX AI.';

function NewPartDialog({ open, onOpenChange, buildId, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; buildId: string; onCreated: (id: string) => void }) {
  const [tpl, setTpl] = useState('u-bracket');
  const [name, setName] = useState('');
  const [upload, setUpload] = useState<{ id: string; filename: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setTpl('u-bracket'); setName(''); setUpload(null); setBusy(false); } }, [open]);
  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try { const fd = new FormData(); fd.append('file', f); fd.append('allow', 'stl'); const r = await api.upload<{ id: string; filename: string }>('/api/uploads', fd); setUpload(r); if (!name) setName(f.name.replace(/\.stl$/i, '').slice(0, 60)); }
    catch (e) { toast.error('Upload failed', (e as ClientError).message); } finally { setBusy(false); }
  };
  const create = async () => {
    setBusy(true);
    try {
      const t = TEMPLATE_BY_ID[tpl];
      const r = await api.post<{ id: string }>(`/api/builds/${buildId}/parts`, { name: name.trim() || t?.name || 'Custom part', template: tpl, uploadId: upload?.id ?? null, material: t?.defaultPrint.material ?? 'PLA' });
      onCreated(r.id); onOpenChange(false); toast.ok('Printed part added');
    } catch (e) { toast.error('Could not add the part', (e as ClientError).message); setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New printed part" description="Pick a parametric template or upload your own STL." width={680}
      footer={<><button className="btn btn-outline" onClick={() => onOpenChange(false)}>Cancel</button><button className="btn btn-primary" disabled={busy || (tpl === 'custom-stl' && !upload)} onClick={create}>{busy ? <Spinner /> : null}Add part</button></>}>
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEMPLATE_DEFS.map((t) => (
            <button key={t.id} onClick={() => setTpl(t.id)} aria-pressed={tpl === t.id} className={`rounded-[8px] border p-3 text-left ${tpl === t.id ? 'border-fdr-red bg-[#FFF5F5]' : 'border-line hover:border-ink-300'}`}>
              <div className="text-[13.5px] font-semibold text-ink-900">{t.name}</div><div className="text-[11.5px] leading-snug text-ink-500">{t.description}</div>
            </button>
          ))}
          <button onClick={() => setTpl('custom-stl')} aria-pressed={tpl === 'custom-stl'} className={`rounded-[8px] border p-3 text-left ${tpl === 'custom-stl' ? 'border-fdr-red bg-[#FFF5F5]' : 'border-line hover:border-ink-300'}`}>
            <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-ink-900"><FileArrowUp size={16} />Upload STL</div><div className="text-[11.5px] text-ink-500">Your own model from CAD</div>
          </button>
        </div>
        {tpl === 'custom-stl' && (
          <div>
            <input ref={file} type="file" accept=".stl" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button className="btn btn-outline h-9" onClick={() => file.current?.click()} disabled={busy}>{busy ? <Spinner /> : <FileArrowUp size={16} />}{upload ? upload.filename : 'Choose STL (≤ 20 MB)'}</button>
          </div>
        )}
        <Field label="Name"><input className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={TEMPLATE_BY_ID[tpl]?.name ?? 'Custom part'} /></Field>
      </div>
    </Dialog>
  );
}

function ParamEditor({ part, onSaved, readOnly }: { part: PartView; onSaved: () => void; readOnly: boolean }) {
  const openSend = useUI((s) => s.openSendToPrinter);
  const qc = useQueryClient();
  const t = TEMPLATE_BY_ID[part.template];
  const [params, setParams] = useState(part.params);
  const [meta, setMeta] = useState({ name: part.name, material: part.material, color: part.color, defaultQty: part.defaultQty, legality: part.legality, purpose: part.purpose ?? '' });
  const [saving, setSaving] = useState(false);
  useEffect(() => { setParams(part.params); setMeta({ name: part.name, material: part.material, color: part.color, defaultQty: part.defaultQty, legality: part.legality, purpose: part.purpose ?? '' }); }, [part]);
  const key = JSON.stringify(params);
  const [debounced, setDebounced] = useState(key);
  useEffect(() => { const h = setTimeout(() => setDebounced(key), 250); return () => clearTimeout(h); }, [key]);
  const preview = useQuery({
    queryKey: ['part-preview', part.template, debounced, meta.material],
    queryFn: () => api.post<Preview>('/api/printing/preview', { template: part.template, params: JSON.parse(debounced), material: meta.material }),
    enabled: !!t, placeholderData: (p) => p,
  });
  const stl = useQuery({ queryKey: ['part-mesh', part.id, 'upload'], queryFn: () => api.get<{ positions: number[]; indices: number[]; bbox: { min: number[]; max: number[] } }>(`/api/parts/${part.id}/mesh`), enabled: !t });
  const mesh = t ? preview.data : stl.data;
  const dirty = key !== JSON.stringify(part.params) || meta.name !== part.name || meta.material !== part.material || meta.color !== part.color || meta.defaultQty !== part.defaultQty || meta.legality !== part.legality || meta.purpose !== (part.purpose ?? '');
  const size = mesh ? [0, 1, 2].map((k) => Math.round((mesh.bbox.max[k] - mesh.bbox.min[k]) * 10) / 10) : null;
  const save = async () => {
    setSaving(true);
    try { await api.patch(`/api/parts/${part.id}`, { ...meta, purpose: meta.purpose || null, params: t ? params : undefined }); onSaved(); qc.invalidateQueries({ queryKey: ['part-mesh', part.id] }); toast.ok('Saved'); }
    catch (e) { toast.error('Could not save', (e as ClientError).message); } finally { setSaving(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid content-start gap-3">
        <div className="relative h-[360px] overflow-hidden rounded-[10px] border border-line">
          {mesh ? <MeshViewer positions={mesh.positions} indices={mesh.indices} color={meta.color} className="h-full w-full" /> : <div className="flex h-full items-center justify-center bg-[#F4F6F8]"><Spinner /></div>}
          {preview.isFetching && <span className="absolute right-3 top-3"><Spinner size={14} /></span>}
          <div className="absolute left-3 top-3"><Badge tone={LEGALITY_BADGE[meta.legality]?.tone ?? 'grey'}>{LEGALITY_BADGE[meta.legality]?.label}</Badge></div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[12.5px] text-ink-600">
          <span>{t ? preview.data?.describe ?? part.describe : part.describe}</span>
          {size && <span className="tabular">{size.join(' × ')} mm</span>}
          {t && preview.data && <span className="tabular">est. {preview.data.estimate.massG} g · {fmtDuration(preview.data.estimate.timeSec)} each</span>}
          {part.defaultPrint && <span>Print: {part.defaultPrint.layerHeightMm} mm layers, {part.defaultPrint.infillPct}% infill, {part.defaultPrint.walls} walls, {part.defaultPrint.supports ? 'supports' : 'no supports'}, {part.defaultPrint.orientation}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary h-9 text-[13px]" disabled={dirty} title={dirty ? 'Save first' : undefined} onClick={() => openSend({ partId: part.id, buildId: part.buildId, qty: part.defaultQty })}><Printer size={16} />Send to Printer</button>
          <button className="btn btn-outline h-9 text-[13px]" onClick={() => download(`/api/parts/${part.id}/stl`)}><DownloadSimple size={16} />Download STL</button>
        </div>
      </div>
      <div className="card grid content-start gap-3 rounded-[10px] p-4">
        <Field label="Name"><input className="input" disabled={readOnly} maxLength={60} value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} /></Field>
        {t?.params.map((p) => (
          <div key={p.key}>
            {p.type === 'number' ? (
              <>
                <div className="label mb-1 flex justify-between"><span>{p.label}</span><span className="tabular text-ink-900">{String(params[p.key])}{p.unit ? ` ${p.unit}` : ''}</span></div>
                <input type="range" disabled={readOnly} min={p.min} max={p.max} step={p.step} value={Number(params[p.key])} onChange={(e) => setParams({ ...params, [p.key]: Number(e.target.value) })} className="w-full accent-[#C8061C]" aria-label={p.label} />
              </>
            ) : p.type === 'enum' ? (
              <Field label={p.label}><select className="input" disabled={readOnly} value={String(params[p.key])} onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}>{p.options?.map((o) => <option key={o}>{o}</option>)}</select></Field>
            ) : (
              <label className="flex items-center justify-between text-[13px] text-ink-800">{p.label}<Switch disabled={readOnly} checked={!!params[p.key]} onCheckedChange={(v) => setParams({ ...params, [p.key]: v })} label={p.label} /></label>
            )}
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Material"><select className="input" disabled={readOnly} value={meta.material} onChange={(e) => setMeta({ ...meta, material: e.target.value })}>{MATERIALS.map((m) => <option key={m}>{m}</option>)}</select></Field>
          <Field label="Default qty"><input className="input" type="number" disabled={readOnly} min={1} max={50} value={meta.defaultQty} onChange={(e) => setMeta({ ...meta, defaultQty: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })} /></Field>
        </div>
        <div>
          <div className="label mb-1.5">Color</div>
          <div className="flex flex-wrap gap-1.5">{COLORS.map(([n, hex]) => <button key={n} disabled={readOnly} aria-label={n} aria-pressed={meta.color === n} onClick={() => setMeta({ ...meta, color: n })} className={`h-6 w-6 rounded-full border-2 ${meta.color === n ? 'border-fdr-red' : 'border-white ring-1 ring-line'}`} style={{ background: hex }} />)}</div>
        </div>
        <Field label="Legality"><select className="input" disabled={readOnly} value={meta.legality} onChange={(e) => setMeta({ ...meta, legality: e.target.value })}>{Object.entries(LEGALITY_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Purpose (optional)"><input className="input" disabled={readOnly} maxLength={200} value={meta.purpose} onChange={(e) => setMeta({ ...meta, purpose: e.target.value })} placeholder="e.g. jig for drilling axle holes" /></Field>
        {!readOnly && <button className="btn btn-primary h-9" disabled={!dirty || saving} onClick={save}>{saving ? <Spinner /> : null}Save changes</button>}
      </div>
    </div>
  );
}

export function PartsTab({ buildId, readOnly }: { buildId: string; readOnly: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['parts', buildId], queryFn: () => api.get<{ program: string; parts: PartView[] }>(`/api/builds/${buildId}/parts`) });
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const parts = useMemo(() => q.data?.parts ?? [], [q.data]);
  const part = parts.find((p) => p.id === sel) ?? parts[0];
  const refresh = () => { qc.invalidateQueries({ queryKey: ['parts', buildId] }); qc.invalidateQueries({ queryKey: ['print-sources'] }); qc.invalidateQueries({ queryKey: ['derived'] }); };
  const dup = async (id: string) => { try { const r = await api.post<{ id: string }>(`/api/parts/${id}/duplicate`); refresh(); setSel(r.id); toast.ok('Duplicated'); } catch (e) { toast.error('Could not duplicate', (e as ClientError).message); } };
  const del = async (p: PartView) => { if (!confirm(`Delete ${p.name}?`)) return; try { await api.del(`/api/parts/${p.id}`); refresh(); setSel(null); toast.ok('Deleted'); } catch (e) { toast.error('Could not delete', (e as ClientError).message); } };

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 rounded-[8px] border border-[#BFD6F6] bg-[#EEF5FF] px-4 py-3 text-[13px] text-[#1C4A85]"><Info size={18} className="mt-px shrink-0" />{BANNER}</div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="grid h-fit gap-2">
          {!readOnly && <button className="btn btn-primary h-10" onClick={() => setAdding(true)}><Plus size={16} />New printed part</button>}
          {q.isLoading ? <Spinner /> : !parts.length ? <div className="card rounded-[10px] py-6"><EmptyState icon={<Printer size={32} />} text="No printed parts yet." /></div> : parts.map((p) => (
            <div key={p.id} className={`card flex items-center gap-3 rounded-[10px] p-2 ${part?.id === p.id ? 'ring-2 ring-fdr-red' : ''}`}>
              <button onClick={() => setSel(p.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/parts/${p.id}/thumb.png?v=${p.updatedAt}`} alt="" className="h-12 w-16 shrink-0 rounded-md bg-[#F4F6F8] object-contain" />
                <span className="min-w-0"><span className="block truncate text-[13px] font-semibold text-ink-900">{p.name}</span><span className="block truncate text-[11.5px] text-ink-500">{p.templateName} · {p.material}</span><Badge tone={p.legalityBadge.tone} className="mt-1">{p.legalityBadge.label}</Badge></span>
              </button>
              {!readOnly && (
                <div className="flex flex-col">
                  <button aria-label={`Duplicate ${p.name}`} onClick={() => dup(p.id)} className="rounded p-1 text-ink-400 hover:bg-black/5 hover:text-ink-900"><Copy size={15} /></button>
                  <button aria-label={`Delete ${p.name}`} onClick={() => del(p)} className="rounded p-1 text-ink-400 hover:bg-black/5 hover:text-fdr-red"><Trash size={15} /></button>
                </div>
              )}
            </div>
          ))}
        </aside>
        {part ? <ParamEditor key={part.id} part={part} onSaved={refresh} readOnly={readOnly} /> : <div className="card rounded-[10px] p-10 text-center text-[13px] text-ink-500">Add a printed part to design brackets, spacers, gears and mounts — the drawing and STL are generated for you.</div>}
      </div>
      <NewPartDialog open={adding} onOpenChange={setAdding} buildId={buildId} onCreated={(id) => { refresh(); setSel(id); }} />
    </div>
  );
}
