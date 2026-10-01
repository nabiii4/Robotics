'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CaretLeft, CaretRight, CheckCircle, Pause, Play, Warning } from '@phosphor-icons/react';
import { api } from '@/lib/client/api';
import { CATALOG } from '@/lib/robot/catalog';
import { useMe } from '../shell/AppShell';
import { LazyRobotCanvas, ViewerToolbar, type Derived, type ViewerApi } from '../viewer3d/Viewer';

export interface CompareRow { key: string; partId: string; name: string; sku: string | null; need: number; itemId: string | null; itemName: string | null; onHand: number; reserved: number; available: number; short: number; onOrder: number }
export function useBomCompare(buildId: string) {
  return useQuery({ queryKey: ['bom-compare', buildId], queryFn: () => api.get<{ rows: CompareRow[] }>(`/api/builds/${buildId}/bom-compare`) });
}

export function AssemblyTab({ d }: { d: Derived }) {
  const { me } = useMe();
  const apiRef = useRef<ViewerApi | null>(null);
  const [pan, setPan] = useState(false);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(false);
  const cmp = useBomCompare(d.build.id);
  const steps = d.steps;
  const s = steps[step];
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setStep((i) => { if (i >= steps.length - 1) { setAuto(false); return i; } return i + 1; }), 3500);
    return () => clearInterval(t);
  }, [auto, steps.length]);
  const uidStep = useMemo(() => { const m = new Map<string, number>(); steps.forEach((st, i) => st.partUids.forEach((u) => m.set(u, i))); return m; }, [steps]);
  const shown = useMemo(() => d.parts.filter((p) => (uidStep.get(p.uid) ?? 0) <= step), [d.parts, uidStep, step]);
  const current = useMemo(() => new Set(s?.partUids ?? []), [s]);
  const need = useMemo(() => {
    const c = new Map<string, number>();
    for (const p of d.parts) if (current.has(p.uid) && !p.ghost) c.set(p.bomKey, (c.get(p.bomKey) ?? 0) + 1);
    return [...c.entries()].map(([key, qty]) => {
      const b = d.bom.find((r) => r.key === key);
      return { key, qty, name: b ? `${b.name}${b.detail ? ` (${b.detail})` : ''}` : CATALOG[key.split(':')[0]]?.name ?? key, row: cmp.data?.rows.find((r) => r.key === key) };
    }).sort((a, b) => b.qty - a.qty);
  }, [d.parts, d.bom, current, cmp.data]);

  return (
    <div className="grid gap-4 xl:grid-cols-[260px_1fr_320px]">
      <aside className="card h-fit max-h-[calc(100vh-260px)] overflow-y-auto rounded-[10px] p-2 scroll-thin">
        <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{steps.length} steps</div>
        {steps.map((st, i) => (
          <button key={st.index} onClick={() => { setStep(i); setAuto(false); }} aria-current={i === step} className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] ${i === step ? 'bg-[#FFF0F0] font-semibold text-fdr-red' : i < step ? 'text-ink-500 hover:bg-[#F6F7F9]' : 'text-ink-800 hover:bg-[#F6F7F9]'}`}>
            <span className="tabular mt-px w-5 shrink-0 text-[11px] text-ink-400">{i + 1}</span>{i < step && <CheckCircle size={14} weight="fill" className="mt-0.5 shrink-0 text-ok" />}<span>{st.title}</span>
          </button>
        ))}
      </aside>
      <div className="viewer-bg relative h-[calc(100vh-260px)] min-h-[460px] overflow-hidden rounded-[10px]">
        <LazyRobotCanvas className="absolute inset-0" apiRef={apiRef} parts={shown} bbox={d.bbox} highlightUids={current} accent={d.spec.appearance.accentColor} metal={d.spec.appearance.metal} quality={me.prefs.quality} reduceMotion={me.prefs.reduceMotion} brainLabel={d.build.name} />
        <ViewerToolbar className="absolute left-4 top-4" api={() => apiRef.current} pan={pan} setPan={setPan} />
        <div className="absolute inset-x-4 bottom-4 flex items-center justify-center gap-2">
          <button aria-label="Previous step" disabled={step === 0} onClick={() => { setStep(step - 1); setAuto(false); }} className="btn btn-dark h-10 w-10 p-0"><CaretLeft size={18} /></button>
          <button aria-label={auto ? 'Pause' : 'Autoplay'} onClick={() => { if (step >= steps.length - 1) setStep(0); setAuto(!auto); }} className="btn btn-dark h-10 px-4 text-[13px]">{auto ? <Pause size={16} /> : <Play size={16} />}{auto ? 'Pause' : 'Autoplay'}</button>
          <button aria-label="Next step" disabled={step >= steps.length - 1} onClick={() => { setStep(step + 1); setAuto(false); }} className="btn btn-dark h-10 w-10 p-0"><CaretRight size={18} /></button>
        </div>
      </div>
      <section className="card h-fit rounded-[10px] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Step {step + 1} of {steps.length}</div>
        <h3 className="mt-0.5 text-[17px] font-bold text-ink-900">{s?.title}</h3>
        <p className="mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-800">{s?.instruction}</p>
        {!!s?.checks.length && (
          <ul className="mt-3 grid gap-1">{s.checks.map((c) => <li key={c} className="flex gap-2 text-[12.5px] text-ink-700"><CheckCircle size={15} className="mt-px shrink-0 text-ok" />{c}</li>)}</ul>
        )}
        {!!s?.notes?.length && <div className="mt-3 rounded-md bg-[#FFF8E1] px-3 py-2 text-[12.5px] text-[#6B4E00]">{s.notes.join(' ')}</div>}
        <h4 className="mb-1.5 mt-4 text-[12px] font-bold uppercase tracking-wider text-ink-500">Parts for this step</h4>
        {!need.length ? <p className="text-[12.5px] text-ink-500">No new parts — adjust and check.</p> : (
          <ul className="grid gap-1">
            {need.map((n) => {
              const ok = !n.row || n.row.available >= n.row.need;
              return (
                <li key={n.key} className="flex items-center gap-2 text-[12.5px]">
                  <span className="tabular w-8 text-right font-semibold text-ink-900">{n.qty}×</span>
                  <span className="flex-1 truncate text-ink-800">{n.name}</span>
                  {n.row ? (ok ? <span className="text-[11px] text-ok">{n.row.available} avail.</span> : <span className="flex items-center gap-1 text-[11px] text-fdr-red"><Warning size={12} />short {n.row.short}</span>) : <span className="text-[11px] text-ink-400">not tracked</span>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
