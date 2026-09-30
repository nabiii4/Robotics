'use client';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { ArrowRight, CaretLeft, CaretRight, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { assemblySheet, type ThemeName } from '@/lib/blueprint/sheets';
import { OVERRIDE } from '@/lib/robot/seasons';
import type { Derived } from '../viewer3d/Viewer';
import { highlight } from './shared';

/** pan/zoom container for an SVG string */
export function SvgPanZoom({ svg, className = '', bg }: { svg: string; className?: string; bg: string }) {
  const [z, setZ] = useState(1);
  const [off, setOff] = useState<[number, number]>([0, 0]);
  const drag = useRef<[number, number] | null>(null);
  const html = useMemo(() => svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" preserveAspectRatio="xMidYMid meet" '), [svg]);
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: bg }}
      onWheel={(e) => { if (!e.currentTarget.matches(':focus-within, :hover')) return; setZ((v) => Math.min(8, Math.max(0.6, v * (e.deltaY < 0 ? 1.12 : 0.9)))); }}
      onPointerDown={(e) => { drag.current = [e.clientX - off[0], e.clientY - off[1]]; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
      onPointerMove={(e) => { if (drag.current) setOff([e.clientX - drag.current[0], e.clientY - drag.current[1]]); }}
      onPointerUp={() => { drag.current = null; }}>
      <div className="h-full w-full cursor-grab active:cursor-grabbing" style={{ transform: `translate(${off[0]}px, ${off[1]}px) scale(${z})`, transformOrigin: 'center' }} dangerouslySetInnerHTML={{ __html: html }} />
      <div className="absolute bottom-2 right-2 flex gap-1">
        <button aria-label="Zoom in" onClick={() => setZ((v) => Math.min(8, v * 1.25))} className="btn btn-dark h-7 w-7 p-0"><MagnifyingGlassPlus size={14} /></button>
        <button aria-label="Zoom out" onClick={() => setZ((v) => Math.max(0.6, v / 1.25))} className="btn btn-dark h-7 w-7 p-0"><MagnifyingGlassMinus size={14} /></button>
        <button onClick={() => { setZ(1); setOff([0, 0]); }} className="btn btn-dark h-7 px-2 text-[11px]">Fit</button>
      </div>
    </div>
  );
}

export function useAssemblySvg(d: Derived | undefined, theme: ThemeName, author = 'FDRHS') {
  return useMemo(() => {
    if (!d) return null;
    return assemblySheet(d.parts, d.metrics, d.bom, {
      buildName: d.build.name, drawingPrefix: d.build.drawingPrefix, version: d.version, program: d.spec.meta.program, season: d.spec.meta.season,
      drawnBy: author, date: new Date(d.createdAt).toLocaleDateString('en-US'), sizing: OVERRIDE.rules.startSizeIn.value, sizingRef: OVERRIDE.rules.startSizeIn.ruleRef,
    }, theme);
  }, [d, theme, author]);
}

export function BlueprintPane({ d, theme, buildId }: { d: Derived | undefined; theme: ThemeName; buildId: string }) {
  const svg = useAssemblySvg(d, theme);
  return (
    <div className="relative h-full w-full">
      {svg ? <SvgPanZoom svg={svg} bg={theme === 'navy' ? '#1E2833' : theme === 'paper' ? '#fff' : '#0F5CB2'} className="h-full w-full" /> : <div className="h-full w-full bg-blueprint-blue" />}
      <Link href={`/builds/${buildId}?tab=blueprint`} className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1.5 text-[12px] font-semibold text-ink-900 hover:bg-white">Open full blueprint<ArrowRight size={13} /></Link>
    </div>
  );
}

export function AssemblyMini({ d, step, setStep }: { d: Derived | undefined; step: number; setStep: (n: number) => void }) {
  const steps = d?.steps ?? [];
  const s = steps[step];
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center">
      <div className="pointer-events-auto flex max-w-[560px] items-center gap-3 rounded-[8px] border border-white/15 bg-[rgb(18_21_25/.92)] px-3 py-2 text-white">
        <button aria-label="Previous step" disabled={step <= 0} onClick={() => setStep(step - 1)} className="btn btn-dark h-8 w-8 p-0"><CaretLeft size={16} /></button>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-wider text-white/60">STEP {step + 1} / {steps.length || 1}</div>
          <div className="truncate text-[13px] font-semibold">{s?.title ?? 'Assembly'}</div>
          <div className="line-clamp-2 text-[11.5px] text-white/75">{s?.instruction}</div>
        </div>
        <button aria-label="Next step" disabled={step >= steps.length - 1} onClick={() => setStep(step + 1)} className="btn btn-dark h-8 w-8 p-0"><CaretRight size={16} /></button>
      </div>
    </div>
  );
}

export function CodePane({ d, buildId }: { d: Derived | undefined; buildId: string }) {
  const lines = (d?.robotConfig.cpp ?? '').split('\n');
  return (
    <div className="relative h-full w-full bg-code-bg">
      <div className="scroll-thin h-full overflow-auto px-3 py-3 font-mono text-[12px] leading-[18px]">
        {lines.map((l, i) => <div key={i} className="flex whitespace-pre"><span className="w-8 shrink-0 pr-3 text-right text-[#5C6370]">{i + 1}</span><span>{highlight(l)}</span></div>)}
      </div>
      <Link href={`/code?build=${buildId}`} className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1.5 text-[12px] font-semibold text-ink-900 hover:bg-white">Open in VEX Code<ArrowRight size={13} /></Link>
      <span className="absolute left-3 top-3 rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-white/70">src/robot-config.cpp · read-only</span>
    </div>
  );
}
