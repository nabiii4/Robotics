'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueries, useQuery } from '@tanstack/react-query';
import { DownloadSimple, FilePdf, Image as ImageIcon, Printer } from '@phosphor-icons/react';
import { api, downloadBlob } from '@/lib/client/api';
import { assemblySheet, drivetrainSheet, printedPartSheet, subsystemsSheet, THEMES, type SheetInfo, type ThemeName } from '@/lib/blueprint/sheets';
import { seasonForProgram } from '@/lib/robot/seasons';
import { useMe } from '../shell/AppShell';
import type { Derived } from '../viewer3d/Viewer';
import { SvgPanZoom } from '../dashboard/BuildPanes';
import { Segmented, Spinner } from '../ui/bits';
import { toast } from '../ui/Toast';
import { useBuildDetail } from './Workspace';

interface PartV { id: string; name: string; templateName: string; material: string; color: string; describe: string; legalityBadge: { label: string }; filename: string | null; params: Record<string, unknown> }

type Mesh = { positions: number[]; indices: number[] } | undefined;

export function buildSheets(d: Derived, theme: ThemeName, pp: PartV[], meshes: Mesh[], author: string) {
  const season = seasonForProgram(d.spec.meta.program);
  const total = 3 + pp.length;
  const info: SheetInfo = { buildName: d.build.name, drawingPrefix: d.build.drawingPrefix, version: d.version, program: d.spec.meta.program, season: d.spec.meta.season || season.name, drawnBy: author, date: new Date(d.createdAt).toLocaleDateString('en-US'), sizing: season.rules.startSizeIn.value as [number, number, number], sizingRef: season.rules.startSizeIn.ruleRef };
  const sheets: { key: string; name: string; svg: string | null }[] = [
    { key: 'assembly', name: 'Assembly', svg: assemblySheet(d.parts, d.metrics, d.bom, info, theme, `1 of ${total}`) },
    { key: 'drivetrain', name: 'Drivetrain', svg: drivetrainSheet(d.spec, d.parts, d.metrics, info, theme, `2 of ${total}`) },
    { key: 'subsystems', name: 'Subsystems', svg: subsystemsSheet(d.spec, d.parts, d.metrics, info, theme, `3 of ${total}`) },
  ];
  pp.forEach((p, i) => {
    const m = meshes[i];
    sheets.push({
      key: p.id, name: p.name,
      svg: m ? printedPartSheet(m, { name: p.name, template: p.templateName, material: p.material, color: p.color, describe: p.describe, legality: p.legalityBadge.label, filename: p.filename ?? `${p.name.replace(/[^\w.-]+/g, '_')}.stl`, sha: p.id.slice(-8).toLowerCase(), params: p.params }, info, String(4 + i), `${4 + i} of ${total}`, theme) : null,
    });
  });
  return sheets;
}

export function useSheetSources(d: Derived) {
  const detail = useBuildDetail(d.build.id);
  const parts = useQuery({ queryKey: ['parts', d.build.id], queryFn: () => api.get<{ parts: PartV[] }>(`/api/builds/${d.build.id}/parts`) });
  const meshQ = useQueries({ queries: (parts.data?.parts ?? []).map((p) => ({ queryKey: ['part-mesh', p.id, p.params], queryFn: () => api.get<{ positions: number[]; indices: number[] }>(`/api/parts/${p.id}/mesh`), staleTime: 300_000 })) });
  const meshes = meshQ.map((q) => q.data);
  const meshKey = meshQ.map((q) => q.dataUpdatedAt).join(',');
  const author = detail.data?.versions.find((v) => v.id === d.versionId)?.author ?? 'FDRHS';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableMeshes = useMemo(() => meshes, [meshKey]);
  return { parts: parts.data?.parts ?? [], meshes: stableMeshes, author, loading: parts.isLoading || meshQ.some((q) => q.isLoading) };
}

function svgSize(svg: string) {
  const m = svg.match(/viewBox="([\d.\-\s]+)"/);
  const [, , w, h] = (m?.[1] ?? '0 0 279.4 215.9').split(/\s+/).map(Number);
  return { w, h };
}

export async function svgToPng(svg: string, scale = 4): Promise<Blob> {
  const { w, h } = svgSize(svg);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('Could not render the sheet')); img.src = url; });
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale * 3.78 / 2); c.height = Math.round(h * scale * 3.78 / 2);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'));
}

export async function sheetsToPdf(svgs: string[], filename: string) {
  const { jsPDF } = await import('jspdf');
  await import('svg2pdf.js');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1100px;height:850px;';
  document.body.appendChild(host);
  try {
    for (let i = 0; i < svgs.length; i++) {
      if (i > 0) doc.addPage('letter', 'landscape');
      host.innerHTML = svgs[i];
      const el = host.querySelector('svg')!;
      const { w, h } = svgSize(svgs[i]);
      await (doc as unknown as { svg: (e: Element, o: object) => Promise<unknown> }).svg(el, { x: 0, y: 0, width: w, height: h });
    }
  } finally { host.remove(); }
  doc.save(filename);
}

export function BlueprintTab({ d }: { d: Derived }) {
  const { layout } = useMe();
  const sp = useSearchParams();
  const [theme, setTheme] = useState<ThemeName>(layout === 'a' ? 'blueprint' : 'navy');
  const [sel, setSel] = useState('assembly');
  const [busy, setBusy] = useState<string | null>(null);
  const src = useSheetSources(d);
  const { loading } = src;
  const sheets = useMemo(() => buildSheets(d, theme, src.parts, src.meshes, src.author), [d, theme, src.parts, src.meshes, src.author]);
  const current = sheets.find((s) => s.key === sel) ?? sheets[0];
  const base = `${d.build.drawingPrefix}_v${d.version}`;
  const autoDone = useRef(false);

  const exportPdf = async () => {
    if (sheets.some((s) => !s.svg)) { toast.info('Still drawing printed part sheets — try again in a second.'); return; }
    setBusy('pdf');
    try { await sheetsToPdf(sheets.map((s) => s.svg!), `${base}_blueprints.pdf`); toast.ok('Blueprint PDF downloaded', `${sheets.length} sheets`); }
    catch (e) { toast.error('PDF export failed', (e as Error).message); }
    finally { setBusy(null); }
  };
  useEffect(() => {
    if (sp.get('export') === 'pdf' && !loading && !autoDone.current) { autoDone.current = true; exportPdf(); }
  }, [sp, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportSvg = () => current.svg && downloadBlob(new Blob([current.svg], { type: 'image/svg+xml' }), `${base}_${current.key === 'assembly' || current.key === 'drivetrain' || current.key === 'subsystems' ? current.key : current.name.replace(/\W+/g, '_')}.svg`);
  const exportPng = async () => {
    if (!current.svg) return;
    setBusy('png');
    try { downloadBlob(await svgToPng(current.svg), `${base}_${current.name.replace(/\W+/g, '_')}.png`); } catch (e) { toast.error('PNG export failed', (e as Error).message); } finally { setBusy(null); }
  };
  const print = () => {
    const svgs = buildSheets(d, 'paper', src.parts, src.meshes, src.author).map((s) => s.svg).filter(Boolean) as string[];
    const w = window.open('', '_blank');
    if (!w) { toast.error('Allow pop-ups to print'); return; }
    w.document.write(`<!doctype html><html><head><title>${base} blueprints</title><style>@page{size:letter landscape;margin:0}body{margin:0}svg{width:11in;height:8.5in;display:block;page-break-after:always}</style></head><body>${svgs.join('')}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="card h-fit rounded-[10px] p-2">
        <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Sheets</div>
        {sheets.map((s, i) => (
          <button key={s.key} onClick={() => setSel(s.key)} aria-current={sel === s.key} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${sel === s.key ? 'bg-[#FFF0F0] font-semibold text-fdr-red' : 'text-ink-800 hover:bg-[#F6F7F9]'}`}>
            <span className="tabular w-5 text-[11px] text-ink-400">{i + 1}</span><span className="truncate">{s.name}</span>{!s.svg && <Spinner size={12} />}
          </button>
        ))}
      </aside>
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={theme} onChange={setTheme} options={[{ value: 'blueprint', label: 'Blueprint' }, { value: 'navy', label: 'Navy' }, { value: 'paper', label: 'Paper' }]} />
          <div className="ml-auto flex flex-wrap gap-2">
            <button className="btn btn-outline h-9 text-[13px]" onClick={exportPdf} disabled={!!busy}>{busy === 'pdf' ? <Spinner /> : <FilePdf size={16} />}PDF (all sheets)</button>
            <button className="btn btn-outline h-9 text-[13px]" onClick={exportSvg} disabled={!current.svg}><DownloadSimple size={16} />SVG</button>
            <button className="btn btn-outline h-9 text-[13px]" onClick={exportPng} disabled={!current.svg || !!busy}>{busy === 'png' ? <Spinner /> : <ImageIcon size={16} />}PNG</button>
            <button className="btn btn-outline h-9 text-[13px]" onClick={print} disabled={loading}><Printer size={16} />Print</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-[10px] border border-line">
          {current.svg ? <SvgPanZoom key={`${current.key}-${theme}`} svg={current.svg} bg={THEMES[theme].bg} className="aspect-[279.4/215.9] w-full" /> : <div className="flex aspect-[279.4/215.9] items-center justify-center bg-[#F6F7F9] text-[13px] text-ink-500"><Spinner />&nbsp;Drawing sheet…</div>}
        </div>
      </div>
    </div>
  );
}
