'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Printer, Cube, DotsThree, CaretDown } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { useBrain } from '@/lib/client/stores';
import { thumbnailSvg } from '@/lib/blueprint/sheets';
import type { PartInstance } from '@/lib/robot/generator/core';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '../ui/Menu';
import { Tip } from '../ui/Tip';
import { toast } from '../ui/Toast';
import { usePresence } from '../shell/HeaderItems';
import { BASE } from '@/lib/client/base';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Dash {
  now: number;
  stats: { brain: { remoteWho: string | null; online: boolean }; printer: { status: 'READY' | 'BUSY' | 'OFFLINE'; printers: { name: string; state: string; adapter: string }[] }; partsInQueue: number };
  build: null | { id: string; name: string; tagline: string | null; status: string; program: string; programLabel: string; version: number; versionId: string; drawingPrefix: string; updatedAt: number; blueprintUpdatedAt: number; metrics: { length: number; width: number; height: number; weight: number }; subsystems: { id: string; name: string; status: string }[]; failing: number };
  queue: { a: Job[]; b: Job[]; activeCount: number };
  activity: { id: string; type: string; createdAt: number; actor: { id: string; name: string; initial: string; color: string } | null; text: string; parts: { t: string; underline?: boolean; strong?: boolean; link?: string }[]; href: string }[];
  readiness: { percent: number; categories: { key: string; label: string; state: string; done: number; total: number }[]; target: { id: string; name: string; shortName: string; startDate: string } | null };
  inventory: { total: number; low: number; out: number; onOrder: number; byCategory: Record<string, number> };
  code: null | { fileId: string; path: string; lines: string[]; errors: number | null; engine: string | null };
  unread: number;
}
export interface Job { id: string; name: string; material: string; layer: number; color: string; quantity: number; status: string; progress: number; remainingSec: number; customPartId: string | null; uploadId: string | null; finishedAt: number | null; printerId: string | null }

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dash>('/api/dashboard'),
    refetchInterval: (q) => ((q.state.data as Dash | undefined)?.queue.b.some((j) => j.status === 'printing') ? 5000 : 15000),
  });
}

export function BrainStat({ variant }: { variant: 'a' | 'b' }) {
  const { status, connect, setConsole } = useBrain();
  const pres = usePresence();
  const online = status === 'connected' || pres.data?.online;
  const click = async () => {
    try { if (status !== 'connected' && status !== 'unsupported') await connect(); setConsole(true); }
    catch (e) { toast.error('Could not connect to the Brain', (e as Error).message); setConsole(true); }
  };
  const tip = status === 'connected' ? 'Connected in this browser' : pres.data?.online ? `Connected on ${pres.data.who}'s laptop` : 'Click to connect the VEX Brain over USB (Chrome/Edge)';
  return (
    <Tip label={tip}>
      <button onClick={click} aria-label="VEX Brain — open Serial Console" className={`flex h-full w-full items-center bg-white text-left text-ink-900 shadow-[0_6px_18px_rgb(16_24_40/.08)] transition-shadow hover:shadow-[0_8px_22px_rgb(16_24_40/.13)] ${variant === 'a' ? 'gap-[14px] rounded-[6px] px-5' : 'gap-3 rounded-[8px] px-[14px]'}`}>
        <Cpu size={variant === 'a' ? 30 : 34} />
        <span className="flex flex-col gap-1">
          <span className="text-[13px] font-medium leading-4">VEX Brain</span>
          <span className={`flex items-center gap-1.5 text-[13.5px] font-extrabold leading-4 ${online ? 'text-ok' : 'text-ink-400'}`}><span className={`block h-2 w-2 rounded-full ${online ? 'bg-ok' : 'bg-ink-300'}`} />{online ? 'ONLINE' : 'OFFLINE'}</span>
        </span>
      </button>
    </Tip>
  );
}

export function PrinterStat({ variant, d }: { variant: 'a' | 'b'; d: Dash | undefined }) {
  const st = d?.stats.printer.status ?? 'OFFLINE';
  const color = st === 'READY' ? 'text-ok' : st === 'BUSY' ? 'text-[#B98900]' : 'text-ink-400';
  const dot = st === 'READY' ? 'bg-ok' : st === 'BUSY' ? 'bg-warn' : 'bg-ink-300';
  return (
    <Tip label={<div>{(d?.stats.printer.printers ?? []).map((p) => <div key={p.name}>{p.name}: {p.state} ({p.adapter})</div>)}</div>}>
      <Link href="/printer" className={`flex h-full w-full items-center bg-white text-ink-900 shadow-[0_6px_18px_rgb(16_24_40/.08)] transition-shadow hover:shadow-[0_8px_22px_rgb(16_24_40/.13)] ${variant === 'a' ? 'gap-[14px] rounded-[6px] px-5' : 'gap-3 rounded-[8px] px-[14px]'}`}>
        <Printer size={variant === 'a' ? 30 : 34} />
        <span className="flex flex-col gap-1">
          <span className="text-[13px] font-medium leading-4">3D Printer</span>
          <span className={`flex items-center gap-1.5 text-[13.5px] font-extrabold leading-4 ${color}`}><span className={`block h-2 w-2 rounded-full ${dot}`} />{st}</span>
        </span>
      </Link>
    </Tip>
  );
}

export function QueueStat({ variant, d }: { variant: 'a' | 'b'; d: Dash | undefined }) {
  return (
    <Link href="/printer?tab=active" className={`flex h-full w-full items-center bg-white text-ink-900 shadow-[0_6px_18px_rgb(16_24_40/.08)] transition-shadow hover:shadow-[0_8px_22px_rgb(16_24_40/.13)] ${variant === 'a' ? 'gap-[14px] rounded-[6px] px-5' : 'gap-3 rounded-[8px] px-[14px]'}`}>
      <Cube size={variant === 'a' ? 30 : 34} />
      <span className="flex flex-col gap-0.5">
        <span className="tabular text-[16px] font-extrabold leading-[19px]">{d?.stats.partsInQueue ?? '–'}</span>
        <span className="text-[12.5px] font-medium leading-[15px]">Parts in Queue</span>
      </span>
    </Link>
  );
}

export const STATUS_LABEL: Record<string, string> = { planned: 'Planned', in_progress: 'In Progress', testing: 'Testing', ready: 'Competition Ready', archived: 'Archived' };

export function StatusMenu({ buildId, status, children }: { buildId: string; status: string; children: React.ReactNode }) {
  const qc = useQueryClient();
  const set = async (s: string) => {
    try { await api.patch(`/api/builds/${buildId}`, { status: s }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['builds'] }); qc.invalidateQueries({ queryKey: ['derived'] }); toast.ok(`Marked ${STATUS_LABEL[s]}`); }
    catch (e) { toast.error('Could not change status', (e as ClientError).message); }
  };
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align="start" width={200}>
        {Object.entries(STATUS_LABEL).map(([k, l]) => <MenuItem key={k} onSelect={() => set(k)}>{k === status ? '✓ ' : ''}{l}</MenuItem>)}
      </MenuContent>
    </Menu>
  );
}

export function JobThumb({ job, className, style }: { job: Pick<Job, 'id' | 'name'>; className?: string; style?: React.CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`${BASE}/api/print/jobs/${job.id}/thumb.png`} alt="" loading="lazy" className={className} style={style} />;
}

export function JobMenu({ job, onChange, trigger }: { job: Job; onChange: () => void; trigger?: React.ReactNode }) {
  const router = useRouter();
  const act = async (a: string, label: string) => {
    try { await api.post(`/api/print/jobs/${job.id}/${a}`); onChange(); toast.ok(label); }
    catch (e) { toast.error('That didn’t work', (e as ClientError).message); }
  };
  return (
    <Menu>
      <MenuTrigger asChild>{trigger ?? <button aria-label={`${job.name} job menu`} className="flex h-6 w-6 items-center justify-center rounded text-ink-500 hover:bg-black/5 hover:text-ink-900"><DotsThree size={18} weight="bold" /></button>}</MenuTrigger>
      <MenuContent width={200}>
        {job.status === 'completed' ? (
          <>
            <MenuItem onSelect={() => act('picked-up', 'Marked picked up')}>Mark picked up</MenuItem>
            <MenuItem onSelect={() => act('reprint', 'Reprint queued')}>Reprint</MenuItem>
            <MenuItem onSelect={() => router.push(`/printer?job=${job.id}`)}>View details</MenuItem>
          </>
        ) : (
          <>
            <MenuItem onSelect={() => router.push(`/printer?job=${job.id}`)}>View details</MenuItem>
            {job.status === 'printing' && <MenuItem onSelect={() => act('pause', 'Paused')}>Pause</MenuItem>}
            {job.status === 'paused' && <MenuItem onSelect={() => act('resume', 'Resumed')}>Resume</MenuItem>}
            <MenuItem onSelect={() => act('up', 'Moved up')}>Move up</MenuItem>
            <MenuItem onSelect={() => act('down', 'Moved down')}>Move down</MenuItem>
            <MenuItem onSelect={() => act('reprint', 'Reprint queued')}>Reprint</MenuItem>
            <MenuItem onSelect={() => download(`/api/print/jobs/${job.id}/stl`)}>Download STL</MenuItem>
            <MenuSeparator />
            <MenuItem danger onSelect={() => { if (confirm(`Cancel ${job.name}?`)) act('cancel', 'Canceled'); }}>Cancel</MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

export function BlueprintThumb({ parts, layout, label, className }: { parts: PartInstance[] | undefined; layout: 'a' | 'b'; label?: string; className?: string }) {
  const svg = useMemo(() => (parts ? thumbnailSvg(parts, layout, label) : null), [parts, layout, label]);
  if (!svg) return <div className={`${className} ${layout === 'a' ? 'bg-blueprint-blue' : 'bg-blueprint-navy'}`} />;
  return <div className={className} role="img" aria-label="Assembly blueprint thumbnail" dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ') }} />;
}

const KW = /\b(void|int|double|bool|return|using|namespace|const|auto|float|char)\b/g;
const CTL = /\b(if|else|while|for|switch|case|break)\b/g;
export function highlight(line: string) {
  if (/^\s*\/\//.test(line)) return <span style={{ color: '#6A9955' }}>{line}</span>;
  const tokens: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")|(\/\/.*$)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_]\w*\b)(?=\s*\()|(\b[a-zA-Z_]\w*\b)|([^A-Za-z_\d"]+)/g;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(line))) {
    const [t] = m;
    let color = '#D4D4D4';
    if (m[1]) color = '#CE9178';
    else if (m[2]) color = '#6A9955';
    else if (m[3]) color = '#B5CEA8';
    else if (m[4]) color = '#DCDCAA';
    else if (m[5]) { KW.lastIndex = 0; CTL.lastIndex = 0; color = CTL.test(t) ? '#C586C0' : (KW.lastIndex = 0, KW.test(t)) ? '#569CD6' : /^(brakeType|vex|motor|motor_group|smartdrive|drivetrain|inertial|rotation|optical|distance|controller|brain|competition|digital_out)$/.test(t) ? '#4EC9B0' : '#D4D4D4'; }
    tokens.push(<span key={i++} style={{ color }}>{t}</span>);
  }
  return tokens;
}

export function CodeMini({ lines, fontSize, lineHeight, gutter, padTop, count }: { lines: string[]; fontSize: number; lineHeight: number; gutter: number; padTop: number; count: number }) {
  return (
    <div className="font-mono" style={{ fontSize, lineHeight: `${lineHeight}px`, paddingTop: padTop }}>
      {lines.slice(0, count).map((l, i) => (
        <div key={i} className="flex whitespace-pre" style={{ height: lineHeight }}>
          <span className="shrink-0 pr-2 text-right text-[#5C6370]" style={{ width: gutter }}>{i + 1}</span>
          <span className="overflow-hidden text-ellipsis">{highlight(l)}</span>
        </div>
      ))}
    </div>
  );
}

export function SubsystemDot({ buildId, sub, onHover, size = 10 }: { buildId: string; sub: { id: string; name: string; status: string }; onHover?: (id: string | null) => void; size?: number }) {
  const qc = useQueryClient();
  const next: Record<string, string> = { planned: 'in_progress', in_progress: 'complete', complete: 'planned' };
  const color = sub.status === 'complete' ? '#1FA84F' : sub.status === 'in_progress' ? '#FCC100' : '#FFFFFF';
  const cycle = async () => {
    try { await api.patch(`/api/builds/${buildId}/subsystems/${sub.id}/status`, { status: next[sub.status] ?? 'planned' }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['derived'] }); }
    catch (e) { toast.error('Could not update status', (e as ClientError).message); }
  };
  return (
    <Tip label={`${sub.status.replace('_', ' ')} — click to change`}>
      <button onClick={cycle} onMouseEnter={() => onHover?.(sub.id)} onMouseLeave={() => onHover?.(null)} aria-label={`${sub.name}: ${sub.status.replace('_', ' ')} — change status`} className="block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
    </Tip>
  );
}
export { CaretDown };
