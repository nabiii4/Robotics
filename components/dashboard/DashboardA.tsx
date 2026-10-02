'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Code, Cube, CornersOut, DotsThree, FileText, Gear, GearSix, Package, Plus, Printer, Robot, SquaresFour, Target, UsersThree, Warning, Wrench, X, Cpu } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { useMentor, useUI } from '@/lib/client/stores';
import { agoA, captionAgo, hm, monthYear } from '@/lib/format';
import { SchoolSketch } from '../brand/Brand';
import { Donut, EmptyState, Progress, Skeleton, Spinner } from '../ui/bits';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from '../ui/Menu';
import { toast } from '../ui/Toast';
import { LazyRobotCanvas, ViewerToolbar, ViewPresets, useDerived, type Preset, type ViewerApi } from '../viewer3d/Viewer';
import { BlueprintPane, AssemblyMini, CodePane } from './BuildPanes';
import { BrainStat, PrinterStat, QueueStat, StatusMenu, JobThumb, BlueprintThumb, CodeMini, SubsystemDot, useDashboard, type Dash } from './shared';
import { useMe } from '../shell/AppShell';
import { BASE } from '@/lib/client/base';

type Tab = '3d' | 'blueprint' | 'assembly' | 'code';

export function FullViewer({ open, onOpenChange, buildId, title }: { open: boolean; onOpenChange: (o: boolean) => void; buildId: string; title: string }) {
  const derived = useDerived(open ? buildId : null);
  const { me } = useMe();
  const apiRef = useRef<ViewerApi | null>(null);
  const [preset, setPreset] = useState<Preset>('iso');
  const [pan, setPan] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const m = derived.data?.metrics;
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/60" />
        <D.Content className="fixed inset-3 z-[61] overflow-hidden rounded-[12px] viewer-bg sm:inset-6">
          <D.Title className="sr-only">{title} — 3D viewer</D.Title>
          <D.Description className="sr-only">Full-screen 3D viewer</D.Description>
          {derived.data && <LazyRobotCanvas className="absolute inset-0" apiRef={apiRef} parts={derived.data.parts} bbox={derived.data.bbox} highlight={hover} accent={derived.data.spec.appearance.accentColor} metal={derived.data.spec.appearance.metal} quality={me.prefs.quality} reduceMotion={me.prefs.reduceMotion} brainLabel={title} />}
          <div className="absolute left-4 top-4 text-[15px] font-bold text-white">{title}</div>
          <ViewerToolbar className="absolute left-4 top-14" api={() => apiRef.current} pan={pan} setPan={setPan} />
          <ViewPresets className="absolute bottom-4 left-4" value={preset} onChange={(p) => { setPreset(p); apiRef.current?.preset(p); }} />
          {m && derived.data && (
            <div className="absolute right-4 top-14 hidden w-[220px] rounded-[8px] border border-white/[.12] bg-[rgb(18_21_25/.92)] p-4 text-white md:block">
              <div className="text-[13px] font-bold">Robot Specs</div>
              {[['Length', m.startSize.length], ['Width', m.startSize.width], ['Height', m.startSize.height]].map(([k, v]) => <div key={k as string} className="mt-2 flex justify-between text-[12px]"><span className="text-[#C2C8CD]">{k}</span><span className="tabular">{(v as number).toFixed(1)} in</span></div>)}
              <div className="mt-2 flex justify-between text-[12px]"><span className="text-[#C2C8CD]">Weight (est.)</span><span className="tabular">{m.weightLb.toFixed(1)} lb</span></div>
              <div className="my-3 h-px bg-white/[.12]" />
              <div className="text-[13px] font-bold">Subsystems</div>
              {[{ id: 'drivetrain', name: 'Drivetrain' }, ...derived.data.spec.subsystems].map((s) => (
                <div key={s.id} className="mt-2 flex items-center gap-2 text-[12px]" onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
                  <SubsystemDot buildId={buildId} sub={{ id: s.id, name: s.name, status: derived.data!.statuses[s.id] ?? 'planned' }} onHover={setHover} />{s.name}
                </div>
              ))}
            </div>
          )}
          <D.Close aria-label="Close viewer" className="absolute right-4 top-3 rounded-md p-1.5 text-white/80 hover:bg-white/10 hover:text-white"><X size={20} /></D.Close>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function ActiveBuildA({ d }: { d: Dash }) {
  const b = d.build!;
  const { me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const derived = useDerived(b.id);
  const apiRef = useRef<ViewerApi | null>(null);
  const [tab, setTab] = useState<Tab>('3d');
  const [step, setStep] = useState(0);
  const [full, setFull] = useState(false);
  const setActive = async () => router.push('/builds');
  const duplicate = async () => {
    try { const r = await api.post<{ id: string }>(`/api/builds/${b.id}/duplicate`); qc.invalidateQueries({ queryKey: ['builds'] }); toast.ok('Build duplicated'); router.push(`/builds/${r.id}`); }
    catch (e) { toast.error('Could not duplicate', (e as ClientError).message); }
  };
  const rename = async () => {
    const n = prompt('Rename build', b.name);
    if (!n || !n.trim() || n === b.name) return;
    try { await api.patch(`/api/builds/${b.id}`, { name: n.trim() }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok('Build renamed'); }
    catch (e) { toast.error('Could not rename', (e as ClientError).message); }
  };
  const stepUids = tab === 'assembly' && derived.data ? new Set(derived.data.steps[step]?.partUids ?? []) : null;
  const visibleParts = tab === 'assembly' && derived.data ? derived.data.parts.filter((p) => { const st = derived.data!.steps.findIndex((s) => s.partUids.includes(p.uid)); return st <= step; }) : derived.data?.parts;
  const segs: [Tab, string, typeof Cube][] = [['3d', '3D Model', Cube], ['blueprint', 'Blueprint', FileText], ['assembly', 'Assembly', Wrench], ['code', 'VEX Code', Code]];
  return (
    <section aria-label="Active Build" className="card flex flex-col rounded-[10px] 3xl:h-[387px]">
      <div className="flex items-center gap-[12px] px-[15px] pt-[13px]"><GearSix size={18} weight="fill" className="text-fdr-red-bright" /><h2 className="text-[16px] font-bold leading-5 text-ink-900">Active Build</h2></div>
      <div className="relative mt-[17px] flex items-start gap-[17px] pl-[19px] pr-[15px]">
        <span className="mt-[3px] block h-[33px] w-[4px] shrink-0 rounded-[2px] bg-fdr-red-deep" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-[12px] gap-y-1">
            <Link href={`/builds/${b.id}`} className="truncate text-[20px] font-bold leading-6 text-ink-900 hover:text-fdr-red">{b.name}</Link>
            <StatusMenu buildId={b.id} status={b.status}><button className="h-[24px] rounded-[4px] border border-fdr-red-100 bg-fdr-red-50 px-3 text-[11px] font-bold uppercase tracking-[.04em] text-fdr-red">{b.status.replace('_', ' ')}</button></StatusMenu>
          </div>
          <div className="text-[13px] leading-4 text-ink-500">{b.programLabel}</div>
        </div>
        <Menu>
          <MenuTrigger asChild><button aria-label="Build menu" className="flex h-[20px] w-[26px] items-center justify-center rounded text-ink-900 hover:bg-black/5"><DotsThree size={22} weight="bold" /></button></MenuTrigger>
          <MenuContent width={230}>
            <MenuItem onSelect={() => router.push(`/builds/${b.id}`)}>Open workspace</MenuItem>
            <MenuItem onSelect={rename}>Rename</MenuItem>
            <MenuItem onSelect={() => router.push(`/builds/${b.id}?versions=1`)}>Version history</MenuItem>
            <MenuItem onSelect={duplicate}>Duplicate</MenuItem>
            <MenuSub>
              <MenuSubTrigger>Export ▸</MenuSubTrigger>
              <MenuSubContent>
                <MenuItem onSelect={() => download(`/api/builds/${b.id}/spec.json`)}>RobotSpec JSON</MenuItem>
                <MenuItem onSelect={() => download(`/api/builds/${b.id}/bom.csv`)}>BOM CSV</MenuItem>
                <MenuItem onSelect={() => router.push(`/builds/${b.id}?tab=blueprint&export=pdf`)}>Blueprint PDF</MenuItem>
                <MenuItem onSelect={() => download(`/api/builds/${b.id}/parts/stl.zip`)}>Printed parts (STL zip)</MenuItem>
                <MenuItem onSelect={() => download(`/api/builds/${b.id}/code/zip`)}>Code (zip)</MenuItem>
              </MenuSubContent>
            </MenuSub>
            <MenuSeparator />
            <MenuItem onSelect={setActive}>Set another build active</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="relative mx-[15px] mb-[11px] mt-[10px] min-h-[260px] flex-1 overflow-hidden rounded-[8px] viewer-bg">
        {(tab === '3d' || tab === 'assembly') && derived.data && (
          <LazyRobotCanvas className="absolute inset-0" apiRef={apiRef} parts={visibleParts ?? []} bbox={derived.data.bbox} accent={derived.data.spec.appearance.accentColor} metal={derived.data.spec.appearance.metal} highlightUids={stepUids} quality={me.prefs.quality} reduceMotion={me.prefs.reduceMotion} brainLabel={b.name} />
        )}
        {(tab === '3d' || tab === 'assembly') && !derived.data && <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tracking-[.3em] text-white/50">LOADING MODEL…</div>}
        {tab === 'blueprint' && <BlueprintPane d={derived.data} theme="blueprint" buildId={b.id} />}
        {tab === 'code' && <CodePane d={derived.data} buildId={b.id} />}
        {tab === 'assembly' && <div className="absolute inset-x-0 bottom-[48px]"><AssemblyMini d={derived.data} step={step} setStep={setStep} /></div>}
        {tab === '3d' && (
          <>
            <div aria-hidden className="pointer-events-none absolute left-[31px] top-[49px] hidden text-[10px] font-semibold leading-[12px] tracking-[.35em] text-[#6E7177] xl:block">FDRHS<br />ROBOTICS<div className="mt-[4px] h-[2px] w-[30px] bg-fdr-red" /></div>
            <div aria-hidden className="pointer-events-none absolute right-[4px] top-[60px] hidden text-[10px] font-semibold leading-[14px] tracking-[.35em] text-[#9A9DA3] xl:block">DESIGN<br />ITERATE<br />IMPROVE<br />COMPETE</div>
            <button aria-label="Open full-screen viewer" onClick={() => setFull(true)} className="absolute right-[13px] top-[13px] flex h-[26px] w-[26px] items-center justify-center rounded-[6px] bg-white/[.08] text-white hover:bg-white/20"><CornersOut size={16} /></button>
          </>
        )}
        <div className="absolute bottom-[5px] left-1/2 flex h-[40px] w-[min(568px,calc(100%-24px))] -translate-x-1/2 overflow-hidden rounded-[6px] bg-white shadow-[0_2px_8px_rgb(0_0_0/.25)]" role="tablist" aria-label="Active build views">
          {segs.map(([t, l, Icon], i) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex flex-1 items-center justify-center gap-[7px] text-[13px] font-semibold ${i ? 'border-l border-[#E5E7EB]' : ''} ${tab === t ? 'bg-fdr-red text-white' : 'text-ink-900 hover:bg-[#F6F7F9]'}`}>
              <Icon size={16} weight={t === 'code' ? 'bold' : 'regular'} /><span className="hidden sm:inline">{l}</span>
            </button>
          ))}
        </div>
      </div>
      <FullViewer open={full} onOpenChange={setFull} buildId={b.id} title={b.name} />
    </section>
  );
}

function QueueA({ d }: { d: Dash }) {
  const openSend = useUI((s) => s.openSendToPrinter);
  return (
    <section aria-label="Print Queue" className="card flex flex-col rounded-[10px] 3xl:h-[387px]">
      <div className="flex items-center justify-between px-[19px] pt-[15px]">
        <h2 className="flex items-center gap-[16px] text-[16px] font-bold text-ink-900"><Printer size={18} weight="fill" className="text-fdr-red-bright" />Print Queue</h2>
        <Link href="/printer" className="text-[12px] text-ink-400 hover:text-fdr-red">{d.queue.activeCount} in queue</Link>
      </div>
      <div className="mt-[20px] flex-1 space-y-[6px] px-[13px]">
        {d.queue.a.length === 0 && <EmptyState icon={<Printer size={36} />} text="No prints in the queue" />}
        {d.queue.a.map((j) => (
          <Link key={j.id} href={`/printer?job=${j.id}`} className="flex h-[78px] items-center rounded-[8px] border border-[#E9EBEE] bg-white pl-[7px] pr-[12px] hover:border-[#D5D8DD]" aria-label={`${j.name}, ${Math.round(j.progress * 100)}%, ${hm(j.remainingSec)} remaining`}>
            <span className="block h-[62px] w-[62px] shrink-0 overflow-hidden rounded-[6px] bg-[#F4F6F8]"><JobThumb job={j} className="h-full w-full object-contain" /></span>
            <span className="ml-[13px] min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-[17px] text-ink-900">{j.name}</span>
              <span className="block text-[11.5px] leading-[15px] text-ink-400">{j.material} • {j.layer}mm</span>
              <span className="mt-[8px] flex items-center gap-[8px]"><Progress value={j.progress} className="w-full max-w-[125px]" /><span className="tabular text-[12px] font-medium text-ink-900">{Math.round(j.progress * 100)}%</span></span>
            </span>
            <span className="ml-3 w-[56px] shrink-0">
              <span className="tabular block text-[13px] font-semibold leading-[17px] text-ink-900">{j.status === 'queued' ? '—' : hm(j.remainingSec)}</span>
              <span className="block text-[11px] leading-[15px] text-ink-400">{j.status === 'queued' ? 'queued' : j.status === 'paused' ? 'paused' : 'remaining'}</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="px-[13px] pb-[17px] pt-2">
        <button onClick={() => openSend()} className="btn btn-primary h-[42px] w-full text-[15px]"><Printer size={19} />Send to Printer</button>
      </div>
    </section>
  );
}

function ActivityA({ d }: { d: Dash }) {
  return (
    <section aria-label="Team Activity" className="card rounded-[10px] 3xl:h-[264px]">
      <div className="flex items-center justify-between px-[15px] pt-[12px]">
        <h2 className="flex items-center gap-[12px] text-[16px] font-bold text-ink-900"><UsersThree size={18} weight="fill" className="text-fdr-red-bright" />Team Activity</h2>
        <Link href="/team?tab=activity" className="text-[12px] font-semibold text-fdr-red hover:underline">See all</Link>
      </div>
      <ul className="mt-[14px] px-[15px] pb-2">
        {d.activity.map((a) => (
          <li key={a.id} className="flex h-[44.5px] items-center gap-[18px]">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-av-neutral text-[13px] font-bold text-ink-900">{a.actor?.initial ?? 'AI'}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] leading-4 text-ink-900">
                {a.parts.map((p, i) => (p.underline && p.link ? <Link key={i} href={p.link} className="underline underline-offset-2 hover:text-fdr-red">{p.t}</Link> : <Link key={i} href={a.href} className="hover:text-fdr-red">{p.t}</Link>))}
              </span>
              <span className="block text-[11.5px] leading-[15px] text-ink-400">{agoA(a.createdAt, d.now)}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReadinessA({ d }: { d: Dash }) {
  const open = useUI((s) => s.setReadiness);
  const t = d.readiness.target;
  return (
    <section aria-label="Competition Readiness" className="card rounded-[10px] 3xl:h-[201px]">
      <h2 className="flex items-center gap-[12px] px-[15px] pt-[11px] text-[16px] font-bold text-ink-900"><Target size={18} weight="bold" className="text-fdr-red-bright" />Competition Readiness</h2>
      <div className="flex items-center gap-[34px] px-[15px] pt-[14px]">
        <button onClick={() => open(true)} className="shrink-0 rounded-full" aria-label={`${d.readiness.percent}% ready — open readiness checklist`}>
          <Donut value={d.readiness.percent / 100} size={112} stroke={12} color="#C8061C"><span className="tabular text-[24px] font-extrabold leading-[26px] text-ink-900">{d.readiness.percent}%</span><span className="text-[11px] text-ink-500">Ready</span></Donut>
        </button>
        <ul className="space-y-[10px]">
          {d.readiness.categories.map((c) => (
            <li key={c.key}><button onClick={() => open(true)} className="flex items-center gap-[13px] text-[13px] leading-[18px] text-ink-900 hover:text-fdr-red">{c.state === 'complete' ? <CheckCircle size={15} weight="fill" className="text-ok" /> : <span className="block h-[15px] w-[15px] rounded-full border-[1.5px] border-[#75767D]" />}{c.label}</button></li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between px-[15px] pb-3 pt-[12px]">
        <span className="truncate text-[11px] text-ink-400">{t ? `Target: ${monthYear(t.startDate)} ${t.shortName}` : 'No target competition set'}</span>
        <Link href={t ? `/competitions/${t.id}?tab=checklist` : '/competitions'} className="shrink-0 text-[11.5px] font-semibold text-fdr-red hover:underline">View checklist →</Link>
      </div>
    </section>
  );
}

function WorkspaceA({ d }: { d: Dash }) {
  const derived = useDerived(d.build?.id);
  const openMentor = useMentor((s) => s.openDrawer);
  const qc = useQueryClient();
  const [compiling, setCompiling] = useState(false);
  const router = useRouter();
  const compile = async () => {
    if (!d.build) return;
    setCompiling(true);
    try {
      const r = await api.post<{ errors: number; warnings: number; engine: string }>(`/api/builds/${d.build.id}/code/compile`, {});
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (r.errors) toast.error(`${r.errors} error${r.errors > 1 ? 's' : ''}`, undefined);
      else toast.ok('No errors', r.engine, { label: 'View problems', onClick: () => router.push(`/code?build=${d.build!.id}&panel=problems`) });
      if (r.errors) toast.info('Open the problems list', undefined, { label: 'View problems', onClick: () => router.push(`/code?build=${d.build!.id}&panel=problems`) });
    } catch (e) { toast.error('Compile failed', (e as ClientError).message); }
    finally { setCompiling(false); }
  };
  const head = (Icon: typeof Cube, title: string, action: React.ReactNode, weight: 'fill' | 'bold' = 'fill') => (
    <div className="flex items-center justify-between px-[13px] pt-[13px]">
      <h3 className="flex items-center gap-[7px] text-[13px] font-bold text-ink-900"><Icon size={16} weight={weight} className="text-fdr-red-bright" />{title}</h3>{action}
    </div>
  );
  const cats: [string, string, typeof Cube][] = [['screws_hardware', 'Screws & Hardware', Wrench], ['vex_structural', 'VEX Structural', Cube], ['motors_electronics', 'Motors & Electronics', Cpu], ['printed_parts', '3D Printed Parts', Printer]];
  const chips: [string, string][] = [['improve-intake', 'How can I improve my intake?'], ['which-motor', 'What motor should I use?'], ['explain-code', 'Explain this VEX code'], ['debug', 'Help me debug']];
  const codeStatus = !d.code || d.code.errors == null ? { dot: 'bg-ink-300', text: 'Not checked yet' } : d.code.errors ? { dot: 'bg-fdr-red', text: `${d.code.errors} error${d.code.errors > 1 ? 's' : ''}` } : { dot: 'bg-ok', text: 'No errors' };
  return (
    <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2 xl:grid-cols-3 3xl:grid-cols-[259px_238px_249px_248px] 3xl:gap-x-[13.5px]">
      <section aria-label="Blueprints" className="card rounded-[10px] 3xl:h-[208px]">
        {head(FileText, 'Blueprints', <Link href="/builds?view=blueprints" className="text-[11px] font-semibold text-fdr-red hover:underline">See all</Link>)}
        <Link href={d.build ? `/builds/${d.build.id}?tab=blueprint` : '/builds'} className="mx-[13px] mt-[7px] block h-[130px] overflow-hidden rounded-[4px]" aria-label="Open the assembly blueprint"><BlueprintThumb parts={derived.data?.parts} layout="a" className="h-full w-full" /></Link>
        <div className="px-[13px] pb-3 pt-[7px]"><div className="text-[12px] leading-4 text-ink-900">{d.build ? `${d.build.drawingPrefix}_v${d.build.version}` : '—'}</div><div className="text-[11px] leading-[15px] text-ink-400">{d.build ? `Last edited ${captionAgo(d.build.blueprintUpdatedAt, d.now)}` : ''}</div></div>
      </section>
      <section aria-label="Parts Inventory" className="card rounded-[10px] 3xl:h-[208px]">
        {head(Package, 'Parts Inventory', <Link href="/parts" className="text-[11px] font-semibold text-fdr-red hover:underline">See all</Link>)}
        <div className="mt-[20px] px-[7px]">
          {cats.map(([k, l, Icon], i) => (
            <Link key={k} href={`/parts?category=${k}`} className={`flex h-[27px] items-center gap-[9px] px-[1px] text-[11.5px] text-ink-900 hover:text-fdr-red ${i ? 'border-t border-[#EEF0F2]' : ''}`}><Icon size={14} className="text-ink-700" /><span className="flex-1 truncate">{l}</span><span className="tabular">{d.inventory.byCategory[k] ?? 0}</span></Link>
          ))}
          <Link href="/parts?filter=low" className="mb-3 mt-[7px] flex h-[26px] items-center gap-[8px] rounded-[4px] border border-fdr-red-100 bg-fdr-red-tint px-[8px] text-[11.5px] font-semibold text-fdr-red"><Warning size={14} weight="fill" /><span className="flex-1">Low Stock Items</span><span className="tabular">{d.inventory.low}</span></Link>
        </div>
      </section>
      <section aria-label="VEX Code" className="card rounded-[10px] 3xl:h-[208px]">
        {head(Code, 'VEX Code', <Link href={d.code ? `/code?file=${d.code.fileId}` : '/code'} className="text-[11px] font-semibold text-fdr-red hover:underline">Open</Link>, 'bold')}
        <Link href={d.code ? `/code?file=${d.code.fileId}` : '/code'} className="mx-[7px] mt-[7px] block h-[131px] overflow-hidden rounded-[4px] bg-code-bg" aria-label={`Open ${d.code?.path ?? 'code'} in VEX Code`}>{d.code && <CodeMini lines={d.code.lines} fontSize={9.5} lineHeight={12} gutter={16} padTop={5.5} count={10} />}</Link>
        <div className="flex items-center justify-between px-[11px] pb-2 pt-[6px]">
          <span className="flex items-center gap-[7px] text-[11px] text-ink-700"><span className={`block h-2 w-2 rounded-full ${codeStatus.dot}`} />{codeStatus.text}</span>
          <button onClick={compile} disabled={compiling || !d.build} className="btn btn-primary h-[31px] w-[88px] rounded-[5px] text-[11px]">{compiling ? <Spinner size={12} /> : <>Compile<Gear size={13} /></>}</button>
        </div>
      </section>
      <section aria-label="AI Build Mentor" className="card relative rounded-[10px] sm:col-span-2 xl:col-span-3 3xl:col-span-1 3xl:h-[208px]">
        {head(Robot, 'AI Build Mentor', <button onClick={() => openMentor({ buildId: d.build?.id ?? null })} className="text-[11px] font-medium text-fdr-red underline underline-offset-2">Ask anything</button>)}
        <div className="flex flex-wrap items-start gap-3 px-[9px] pb-3 3xl:block">
          <div className="shrink-0">
            <button aria-label="Open AI Build Mentor" onClick={() => openMentor({ buildId: d.build?.id ?? null })} className="mt-[8px] block"><img src={`${BASE}/brand/mentor-a.png`} alt="" className="h-[123px] w-[88px] object-contain" /></button>
            <div className="ml-[3px] mt-[3px] text-[8.5px] font-semibold leading-[12px] tracking-[.2em] text-ink-400">POWERED BY AI<br />BUILT BY COUGARS</div>
          </div>
          {/* bubble + chips: inside the card below 1600 px, spilling into the page at ≥1600 px (reference composition) */}
          <div className="min-w-0 flex-1 3xl:contents">
            <button onClick={() => openMentor({ buildId: d.build?.id ?? null })} className="relative mt-2 block max-w-[252px] rounded-[10px] border border-[#D5D8DD] bg-white px-[13px] py-[9px] text-left text-[12.5px] leading-[16.5px] text-ink-900 shadow-[0_2px_8px_rgb(16_24_40/.05)] 3xl:absolute 3xl:left-[124px] 3xl:top-[56px] 3xl:mt-0 3xl:h-[70px] 3xl:w-[252px]">
              Hi! I&apos;m your FDR Robotics AI mentor. Ask me about your design, code, parts, or competition rules!
              <span className="absolute -left-[6px] top-[26px] hidden h-[10px] w-[10px] rotate-45 border-b border-l border-[#D5D8DD] bg-white 3xl:block" />
            </button>
            <div className="mt-2 flex flex-wrap gap-[11px] 3xl:absolute 3xl:left-[138px] 3xl:top-[133px] 3xl:mt-0 3xl:w-[400px] 3xl:gap-y-[10px]">
              {chips.map(([id, l]) => <button key={id} onClick={() => openMentor({ message: l, chipId: id, buildId: d.build?.id ?? null, codeContext: id === 'explain-code' && d.code ? { fileId: d.code.fileId } : undefined })} className="h-[27px] whitespace-nowrap rounded-[6px] border border-[#D5D8DD] bg-white px-[14px] text-[12px] text-ink-800 hover:bg-[#F6F7F9]">{l}</button>)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function DashboardA() {
  const { data: d, isLoading } = useDashboard();
  const openNew = useUI((s) => s.setNewBuild);
  return (
    <div className="px-4 sm:px-6 3xl:pl-[20px] 3xl:pr-[16px]">
      {/* hero */}
      <div className="relative 3xl:h-[221px]">
        <div className="pt-4 3xl:absolute 3xl:left-[69px] 3xl:top-[34px] 3xl:pt-0">
          <p className="text-[13px] font-bold leading-[15px] tracking-[.14em] text-ink-900">FRANKLIN D. <span className="text-fdr-red">ROOSEVELT</span> HIGH SCHOOL</p>
          <h1 className="font-display-a mt-[7px] whitespace-nowrap text-[40px] leading-[1.05] text-ink-950 sm:text-[54px] sm:leading-[54px]">Build. <span className="text-fdr-red-bright">Code.</span> Compete.</h1>
          <p className="mt-[5px] text-[17px] leading-[22px] text-ink-600 sm:text-[19px]">Your FDR Robotics engineering hub.</p>
          <div className="mt-[17px] flex flex-wrap gap-[14px]">
            <button onClick={() => openNew(true)} className="btn btn-primary h-[43px] w-[216px] text-[15px]"><Plus size={18} weight="bold" />Start a New Build</button>
            <Link href="/printer" className="btn btn-outline h-[43px] w-[202px] border-[1.5px] border-ink-300 text-[15px]"><Printer size={19} />Open 3D Printer</Link>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute left-[576px] top-[37px] hidden h-[100px] w-px bg-[#C1C2C6] 3xl:block" />
        <div aria-hidden className="pointer-events-none absolute left-[600px] top-[54px] hidden text-[10.5px] font-semibold leading-[15px] tracking-[.32em] text-[#73747D] 3xl:block">STEM<br />INNOVATION<br />TEAMWORK<br />IMPACT<div className="mt-[9px] h-[3px] w-[30px] bg-fdr-red" /></div>
        <div aria-hidden className="pointer-events-none absolute left-[796px] top-[2px] hidden h-[190px] w-[510px] opacity-80 3xl:block" style={{ maskImage: 'linear-gradient(to right, transparent 0%, #000 25%), linear-gradient(to bottom, #000 70%, transparent 100%)', maskComposite: 'intersect', WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 25%)' }}>
          <SchoolSketch className="h-full w-full" />
        </div>
        <div aria-hidden className="pointer-events-none absolute left-[1292px] top-[46px] hidden -rotate-12 whitespace-nowrap font-[family-name:var(--font-script)] text-[23px] leading-[30px] text-[#555A60] 4xl:block">Cougars<br />Engineers<br />Change<br />Tomorrow</div>
        <svg aria-hidden className="pointer-events-none absolute left-[1298px] top-[154px] hidden 4xl:block" width="90" height="26" viewBox="0 0 90 26"><path d="M4 21 C 26 16, 52 10, 84 2" fill="none" stroke="#C8061C" strokeWidth="2.5" strokeLinecap="round" /></svg>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 3xl:absolute 3xl:left-[707px] 3xl:top-[133px] 3xl:mt-0 3xl:flex 3xl:gap-[12px]">
          <div className="h-[62px] 3xl:w-[176px]"><BrainStat variant="a" /></div>
          <div className="h-[62px] 3xl:w-[176px]"><PrinterStat variant="a" d={d} /></div>
          <div className="h-[62px] 3xl:w-[188px]"><QueueStat variant="a" d={d} /></div>
        </div>
      </div>
      {/* main row */}
      <div className="mt-5 grid grid-cols-1 gap-[13px] lg:grid-cols-2 3xl:mt-0 3xl:grid-cols-[676fr_352fr_336fr] 3xl:gap-x-[14px]">
        <div className="lg:col-span-2 3xl:col-span-1">{isLoading || !d ? <Skeleton className="h-[387px] rounded-[10px]" /> : d.build ? <ActiveBuildA d={d} /> : <section className="card flex h-[387px] items-center justify-center rounded-[10px]"><EmptyState icon={<Cube size={40} />} text="No active build yet" action={<button className="btn btn-primary h-10 px-4" onClick={() => openNew(true)}><Plus size={16} />Start a New Build</button>} /></section>}</div>
        {d ? <QueueA d={d} /> : <Skeleton className="h-[387px] rounded-[10px]" />}
        <div className="flex flex-col gap-[14px]">
          {d ? <ActivityA d={d} /> : <Skeleton className="h-[264px] rounded-[10px]" />}
          {d ? <ReadinessA d={d} /> : <Skeleton className="h-[201px] rounded-[10px]" />}
        </div>
      </div>
      {/* workspace */}
      <div className="3xl:-mt-[79px] 3xl:pl-[1px]">
        <h2 className="mb-[9px] mt-5 flex items-center gap-[13px] pl-[16px] text-[16px] font-bold text-ink-900 3xl:mt-0"><SquaresFour size={16} weight="fill" className="text-fdr-red-bright" />Engineering Workspace</h2>
        {d ? <WorkspaceA d={d} /> : <Skeleton className="h-[208px] rounded-[10px]" />}
      </div>
    </div>
  );
}
