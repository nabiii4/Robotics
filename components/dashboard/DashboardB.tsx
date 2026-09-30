'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ChartBar, CheckCircle, Code, Cube, FileText, GearSix, Package, PencilSimple, Play, Plus, Printer, Robot, UsersThree, Wrench } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { useMentor, useUI } from '@/lib/client/stores';
import { agoShort, leftText } from '@/lib/format';
import { HubBanner } from '../brand/Brand';
import { Donut, Progress, Skeleton, StatusDot, EmptyState } from '../ui/bits';
import { toast } from '../ui/Toast';
import { LazyRobotCanvas, ViewerToolbar, ViewPresets, useDerived, type Preset, type ViewerApi } from '../viewer3d/Viewer';
import { BlueprintPane, AssemblyMini, CodePane } from './BuildPanes';
import { BrainStat, PrinterStat, QueueStat, StatusMenu, STATUS_LABEL, JobThumb, JobMenu, BlueprintThumb, CodeMini, SubsystemDot, useDashboard, type Dash } from './shared';
import { useMe } from '../shell/AppShell';

type Tab = '3d' | 'blueprint' | 'assembly' | 'code';
const TABS: [Tab, string, typeof Cube, number][] = [['3d', '3D Model', Cube, 103], ['blueprint', 'Blueprint', FileText, 103], ['assembly', 'Assembly', Wrench, 109], ['code', 'VEX Code', Code, 123]];

function ActiveBuildB({ d }: { d: Dash }) {
  const b = d.build!;
  const { me } = useMe();
  const qc = useQueryClient();
  const derived = useDerived(b.id);
  const apiRef = useRef<ViewerApi | null>(null);
  const [tab, setTab] = useState<Tab>('3d');
  const [preset, setPreset] = useState<Preset>('iso');
  const [pan, setPan] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(b.name);
  const rename = async () => {
    setRenaming(false);
    if (!name.trim() || name === b.name) { setName(b.name); return; }
    try { await api.patch(`/api/builds/${b.id}`, { name: name.trim() }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['builds'] }); toast.ok('Build renamed'); }
    catch (e) { toast.error('Could not rename', (e as ClientError).message); setName(b.name); }
  };
  const stepUids = tab === 'assembly' && derived.data ? new Set(derived.data.steps[step]?.partUids ?? []) : null;
  const dim = tab === 'assembly' && derived.data ? new Set(derived.data.parts.filter((p) => { const st = derived.data!.steps.findIndex((s) => s.partUids.includes(p.uid)); return st >= 0 && st < step; }).map((p) => p.uid)) : null;
  const visibleParts = tab === 'assembly' && derived.data ? derived.data.parts.filter((p) => { const st = derived.data!.steps.findIndex((s) => s.partUids.includes(p.uid)); return st <= step; }) : derived.data?.parts;
  return (
    <section aria-label="Active Build" className="card flex flex-col rounded-[12px] xl:h-[480px]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-[14px] pt-[17px]">
        <div className="min-w-0">
          <div className="flex items-center gap-[10px]">
            <Cube size={21} weight="fill" className="text-fdr-red-bright" />
            <h2 className="text-[17px] font-bold leading-[22px] text-ink-900">Active Build</h2>
            <StatusMenu buildId={b.id} status={b.status}><button className="ml-[18px] h-[26px] rounded-[5px] bg-fdr-red-50 px-3 text-[12.5px] font-medium text-fdr-red" aria-label={`Status: ${STATUS_LABEL[b.status]} — change status`}>{STATUS_LABEL[b.status] ?? b.status}</button></StatusMenu>
          </div>
          <div className="mt-[10px] flex items-center gap-[10px]">
            {renaming ? (
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') { setName(b.name); setRenaming(false); } }} className="input h-8 w-[280px] text-[18px] font-bold" aria-label="Build name" />
            ) : (
              <Link href={`/builds/${b.id}`} className="truncate text-[21px] font-bold leading-6 text-ink-900 hover:text-fdr-red">{b.name}</Link>
            )}
            {!renaming && <button aria-label="Rename build" onClick={() => setRenaming(true)} className="text-ink-500 hover:text-ink-900"><PencilSimple size={14} /></button>}
          </div>
          <div className="mt-[3px] text-[13px] leading-4 text-ink-500">VEX V5 <span className="px-[3px] text-[#C9CCD1]">|</span> {b.tagline ?? b.programLabel}</div>
        </div>
        <div className="flex flex-wrap gap-[8px] pt-[2px]" role="tablist" aria-label="Active build views">
          {TABS.map(([t, l, Icon, w]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`flex h-[35px] items-center justify-center gap-[7px] rounded-[6px] text-[13px] font-medium ${tab === t ? 'bg-fdr-red text-white' : 'border border-[#E3E5E8] bg-[#F2F4F5] text-[#1B1F24] hover:bg-[#E9ECEE]'}`} style={{ width: w }}>
              <Icon size={16} />{l}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mx-[14px] mb-[14px] mt-[14px] min-h-[320px] flex-1 overflow-hidden rounded-[6px] viewer-bg">
        {(tab === '3d' || tab === 'assembly') && derived.data && (
          <LazyRobotCanvas className="absolute inset-0" apiRef={apiRef} parts={visibleParts ?? []} bbox={derived.data.bbox} accent={derived.data.spec.appearance.accentColor} metal={derived.data.spec.appearance.metal}
            highlight={hover} highlightUids={stepUids} dimUids={dim} quality={me.prefs.quality} reduceMotion={me.prefs.reduceMotion} brainLabel={b.name}
            label={`${b.name}: ${derived.data.spec.drivetrain.motors.count}-motor ${derived.data.spec.drivetrain.type}, ${derived.data.spec.drivetrain.wheel.diameterIn} in wheels${derived.data.spec.subsystems.map((s) => `, ${s.name.toLowerCase()}${s.status === 'planned' ? ' planned' : ''}`).join('')}`} />
        )}
        {(tab === '3d' || tab === 'assembly') && !derived.data && <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tracking-[.3em] text-white/50">LOADING MODEL…</div>}
        {tab === 'blueprint' && <BlueprintPane d={derived.data} theme="navy" buildId={b.id} />}
        {tab === 'code' && <CodePane d={derived.data} buildId={b.id} />}
        {tab === 'assembly' && <AssemblyMini d={derived.data} step={step} setStep={setStep} />}
        {tab === '3d' && (
          <>
            <ViewerToolbar className="absolute left-[13px] top-[26px]" api={() => apiRef.current} pan={pan} setPan={setPan} />
            <ViewPresets className="absolute bottom-[9px] left-[13px] hidden sm:flex" value={preset} onChange={(p) => { setPreset(p); apiRef.current?.preset(p); }} />
            <div className="absolute right-[10px] top-[12px] hidden w-[203px] rounded-[8px] border border-white/[.12] bg-[rgb(18_21_25/.92)] px-[14px] pb-[14px] pt-[9px] md:block">
              <div className="text-[13px] font-bold leading-[18px] text-white">Robot Specs</div>
              <dl className="mt-[6px] space-y-[9px] text-[12px] leading-4">
                {[['Length', `${b.metrics.length.toFixed(1)} in`], ['Width', `${b.metrics.width.toFixed(1)} in`], ['Height', `${b.metrics.height.toFixed(1)} in`], ['Weight (est.)', `${b.metrics.weight.toFixed(1)} lb`]].map(([k, v]) => (
                  <div key={k} className="flex justify-between"><dt className="text-[#C2C8CD]">{k}</dt><dd className="tabular text-white">{v}</dd></div>
                ))}
              </dl>
              <div className="my-[12px] h-px bg-white/[.12]" />
              <div className="text-[13px] font-bold leading-[18px] text-white">Subsystems</div>
              <ul className="mt-[6px] space-y-[7px]">
                {b.subsystems.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center gap-[9px] text-[12px] leading-4 text-[#E6E8EA]" onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
                    <SubsystemDot buildId={b.id} sub={s} onHover={setHover} />{s.name}
                  </li>
                ))}
              </ul>
              <Link href={`/builds/${b.id}?tab=specs`} className="mt-[14px] flex h-[34px] items-center justify-center gap-1.5 rounded-[6px] border border-white/35 text-[12.5px] font-medium text-white hover:bg-white/10">View Full Details<ArrowRight size={14} /></Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function QueueB({ d, refresh }: { d: Dash; refresh: () => void }) {
  const openSend = useUI((s) => s.openSendToPrinter);
  const rows = d.queue.b;
  return (
    <section aria-label="Print Queue" className="card flex flex-col rounded-[12px] xl:h-[480px]">
      <div className="flex items-center justify-between px-[20px] pt-[15px]">
        <h2 className="flex items-center gap-[19px] text-[17px] font-bold text-ink-900"><Printer size={20} weight="fill" className="text-fdr-red-bright" />Print Queue</h2>
        <Link href="/printer" className="flex h-[28px] w-[73px] items-center justify-center rounded-[6px] border border-[#D0D3D8] text-[13px] font-medium text-ink-900 hover:bg-[#F6F7F9]">View All</Link>
      </div>
      <div className="mt-[14px] flex-1 px-[14px]">
        {rows.length === 0 && <EmptyState icon={<Printer size={36} />} text="No prints in the queue" />}
        {rows.map((j, i) => {
          const done = j.status === 'completed';
          return (
            <div key={j.id} className={`relative flex h-[84px] items-center gap-[20px] pl-[4px] ${i ? 'border-t border-[#ECEEF0]' : ''}`}>
              <Link href={`/printer?job=${j.id}`} className="block h-[66px] w-[89px] shrink-0 overflow-hidden rounded-[6px] bg-[#F4F5F6]" aria-label={`${j.name} details`}><JobThumb job={j} className="h-full w-full object-contain" /></Link>
              <div className="min-w-0 flex-1 pr-[60px]">
                <Link href={`/printer?job=${j.id}`} className="block truncate text-[13.5px] font-semibold leading-[18px] text-ink-900 hover:text-fdr-red">{j.name}</Link>
                <Progress value={j.progress} color={done ? '#199950' : '#C8061C'} className="mt-[6px] w-full max-w-[151px]" />
                <div className={`tabular mt-[5px] text-[12px] font-bold leading-[15px] ${done ? 'text-ok-strong' : 'text-fdr-red'}`}>{Math.round(j.progress * 100)}%</div>
                <div className="text-[12px] leading-[15px] text-ink-500">{done ? `Finished ${agoShort(j.finishedAt ?? d.now, d.now)}` : j.status === 'queued' ? 'Waiting for a printer' : j.status === 'paused' ? 'Paused' : leftText(j.remainingSec)}</div>
              </div>
              {done ? (
                <JobMenu job={j} onChange={refresh} trigger={<button className="absolute right-[6px] top-[38px] flex flex-col items-start gap-[5px] text-left" aria-label={`${j.name} completed — menu`}><CheckCircle size={16} weight="fill" className="text-ok" /><span className="text-[12px] font-medium text-ok-strong">Completed</span></button>} />
              ) : (
                <div className="absolute right-[4px] top-[14px]"><JobMenu job={j} onChange={refresh} /></div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-[14px] pb-[23px]">
        <button onClick={() => openSend()} className="btn btn-primary h-[46px] w-full text-[16px]"><Printer size={20} />Send to Printer</button>
      </div>
    </section>
  );
}

function ActivityB({ d }: { d: Dash }) {
  return (
    <section aria-label="Team Activity" className="card rounded-[12px] xl:h-[327px]">
      <div className="flex items-center justify-between px-[17px] pt-[14px]">
        <h2 className="flex items-center gap-[16px] text-[17px] font-bold text-ink-900"><UsersThree size={20} weight="fill" className="text-fdr-red-bright" />Team Activity</h2>
        <Link href="/team?tab=activity" className="flex h-[28px] w-[73px] items-center justify-center rounded-[6px] border border-[#D0D3D8] text-[13px] font-medium text-ink-900 hover:bg-[#F6F7F9]">View All</Link>
      </div>
      <ol className="relative mt-[21px] px-[19px] pb-3">
        <span aria-hidden className="absolute bottom-[30px] left-[34px] top-[15px] w-px bg-[#ECEEF0]" />
        {d.activity.map((a) => (
          <li key={a.id} className="relative flex h-[52.75px] items-start gap-[17px]">
            <span className="relative z-[1] flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white shadow-[0_0_0_3px_#fff]" style={{ background: a.actor?.color ?? '#C8061C' }}>{a.actor?.initial ?? 'AI'}</span>
            <Link href={a.href} className="min-w-0 pt-[-2px] leading-[17px] hover:text-fdr-red">
              <span className="block truncate text-[13px] text-ink-900">{a.parts.map((p, i) => <span key={i} className={p.strong ? 'font-semibold' : ''}>{p.t}</span>)}</span>
              <span className="block text-[12px] leading-4 text-ink-400">{agoShort(a.createdAt, d.now)}</span>
            </Link>
          </li>
        ))}
        {d.activity.length === 0 && <li className="py-6 text-center text-[13px] text-ink-500">No activity yet.</li>}
      </ol>
    </section>
  );
}

function ReadinessB({ d }: { d: Dash }) {
  const open = useUI((s) => s.setReadiness);
  return (
    <section aria-label="Competition Readiness" className="card rounded-[12px] xl:h-[159px]">
      <h2 className="flex items-center gap-[16px] px-[17px] pt-[11px] text-[17px] font-bold text-ink-900"><ChartBar size={20} weight="fill" className="text-fdr-red-bright" />Competition Readiness</h2>
      <div className="flex items-center gap-[46px] px-[54px] pb-3 pt-[3px]">
        <button onClick={() => open(true)} aria-label={`${d.readiness.percent}% ready — open readiness checklist`} className="shrink-0 rounded-full">
          <Donut value={d.readiness.percent / 100}><span className="tabular text-[24px] font-extrabold leading-[26px] text-ink-900">{d.readiness.percent}<span className="text-[16px]">%</span></span><span className="text-[12px] leading-[15px] text-ink-600">Ready</span></Donut>
        </button>
        <ul className="space-y-[7px]">
          {d.readiness.categories.map((c) => (
            <li key={c.key}><button onClick={() => open(true)} className="flex items-center gap-[19px] text-[13px] leading-[18px] text-ink-900 hover:text-fdr-red"><StatusDot state={c.state === 'complete' ? 'complete' : c.state === 'in_progress' ? 'in_progress' : 'planned'} />{c.label}</button></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WorkspaceB({ d }: { d: Dash }) {
  const derived = useDerived(d.build?.id);
  const openMentor = useMentor((s) => s.openDrawer);
  const [q, setQ] = useState('');
  const router = useRouter();
  const head = (Icon: typeof Cube, title: string, sub: string, weight: 'fill' | 'bold' = 'fill') => (
    <div className="flex items-start gap-[17px] px-[19px] pt-[12px]">
      <Icon size={22} weight={weight} className="mt-[1px] shrink-0 text-fdr-red-bright" />
      <div className="min-w-0"><div className="text-[14px] font-bold leading-[18px] text-ink-900">{title}</div><div className="truncate text-[12px] leading-4 text-ink-500">{sub}</div></div>
    </div>
  );
  const arrow = (href: string, label: string) => <Link href={href} aria-label={label} className="flex h-[38px] w-[39px] shrink-0 items-center justify-center rounded-[8px] border border-[#D9DBDD] bg-white text-ink-900 hover:bg-[#F6F7F9]"><ArrowRight size={18} /></Link>;
  const play = async () => {
    if (!d.build) return;
    try {
      const r = await api.post<{ errors: number }>(`/api/builds/${d.build.id}/code/compile`, {});
      if (r.errors) { toast.error(`${r.errors} error${r.errors > 1 ? 's' : ''} — fix them first`); router.push(`/code?build=${d.build.id}&panel=problems`); }
      else router.push(`/code?build=${d.build.id}&panel=auton`);
    } catch (e) { toast.error('Check failed', (e as ClientError).message); }
  };
  return (
    <div className="grid gap-[14px] md:grid-cols-2 xl:grid-cols-[367fr_356fr_355fr_482fr]">
      <section aria-label="Blueprints" className="card relative rounded-[12px] xl:h-[132px]">
        {head(FileText, 'Blueprints', 'Design, view, and share CAD drawings.')}
        <div className="flex items-center gap-[14px] px-[12px] pb-[9px] pt-[7px]">
          <Link href={d.build ? `/builds/${d.build.id}?tab=blueprint` : '/builds'} className="block h-[73px] min-w-0 flex-1 overflow-hidden rounded-[4px]" aria-label="Open the assembly blueprint"><BlueprintThumb parts={derived.data?.parts} layout="b" label={d.build ? `${d.build.drawingPrefix}_v${d.build.version}-01` : ''} className="h-full w-full" /></Link>
          {arrow(d.build ? `/builds/${d.build.id}?tab=blueprint` : '/builds', 'Open Blueprints')}
        </div>
      </section>
      <section aria-label="Parts Inventory" className="card rounded-[12px] xl:h-[132px]">
        {head(Package, 'Parts Inventory', 'Manage parts and track stock levels.')}
        <div className="flex items-center gap-[10px] px-[13px] pt-[7px]">
          {[['/parts', d.inventory.total, 'Total Parts', 'text-ink-900'], ['/parts?filter=low', d.inventory.low, 'Low Stock', 'text-fdr-red'], ['/parts?tab=orders', d.inventory.onOrder, 'On Order', 'text-fdr-red']].map(([href, n, l, c]) => (
            <Link key={String(l)} href={String(href)} className="flex h-[56px] min-w-0 flex-1 flex-col justify-center gap-[2px] rounded-[6px] border border-[#ECEEF0] bg-[#F7F8F9] pl-[11px] hover:border-[#D9DBDD]">
              <span className={`tabular text-[20px] font-extrabold leading-[22px] ${c}`}>{n as number}</span><span className="truncate text-[11.5px] leading-[14px] text-ink-500">{l}</span>
            </Link>
          ))}
          {arrow('/parts', 'Open Parts & Inventory')}
        </div>
      </section>
      <section aria-label="VEX Code" className="card rounded-[12px] xl:h-[132px]">
        {head(Code, 'VEX Code', 'Write, test, and deploy code.', 'bold')}
        <div className="flex items-center gap-[15px] px-[12px] pb-[9px] pt-[7px]">
          <Link href={d.code ? `/code?file=${d.code.fileId}` : '/code'} className="block h-[73px] min-w-0 flex-1 overflow-hidden rounded-[4px] bg-code-bg" aria-label={`Open ${d.code?.path ?? 'code'} in VEX Code`}>{d.code && <CodeMini lines={d.code.lines} fontSize={10} lineHeight={11} gutter={18} padTop={3.5} count={6} />}</Link>
          <button onClick={play} aria-label="Check code and open Auton Preview" className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[8px] border border-[#D9DBDD] bg-white text-fdr-red hover:bg-[#F6F7F9]"><Play size={18} weight="fill" /></button>
        </div>
      </section>
      <section aria-label="AI Build Mentor" className="card relative rounded-[12px] xl:h-[132px]">
        {head(Robot, 'AI Build Mentor', 'Get help with design, code, and troubleshooting.')}
        <button aria-label="Open AI Build Mentor" onClick={() => openMentor()} className="absolute right-[86px] top-[15px] hidden lg:block"><img src="/brand/mentor-b.png" alt="" className="h-[67px] w-[67px]" /></button>
        <button onClick={() => openMentor()} className="absolute right-[6px] top-[10px] hidden w-[79px] rounded-[8px] border border-[#D8E1EA] bg-white px-[7px] py-[3px] text-left text-[11px] font-medium leading-[13px] text-[#1B1F24] shadow-[0_2px_6px_rgb(16_24_40/.06)] lg:block">How can I help today?<span className="absolute -left-[5px] top-[11px] h-2 w-2 rotate-45 border-b border-l border-[#D8E1EA] bg-white" /></button>
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim()) { openMentor({ message: q.trim(), buildId: d.build?.id ?? null }); setQ(''); } }} className="mx-[13px] mt-[10px] flex h-[32px] max-w-[288px] items-center rounded-[6px] border border-[#D9DBDD] bg-white">
          <input aria-label="Ask the AI Build Mentor" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your build..." className="h-full min-w-0 flex-1 bg-transparent px-[11px] text-[12.5px] text-ink-900 outline-none placeholder:text-ink-400" />
          <button aria-label="Send to mentor" className="flex h-full w-[34px] items-center justify-center border-l border-[#E3E5E8] text-ink-900"><ArrowRight size={16} /></button>
        </form>
        <div className="mx-[13px] mt-[11px] flex flex-wrap gap-[8px] pb-3">
          {[['design-tips', 'Design tips'], ['code-help', 'VEX code help'], ['troubleshoot', 'Troubleshoot'], ['rules', 'Competition rules']].map(([id, l]) => (
            <button key={id} onClick={() => openMentor({ message: l, chipId: id, buildId: d.build?.id ?? null })} className="h-[25px] rounded-[6px] bg-chip-b px-[10px] text-[12px] text-[#1B1F24] hover:bg-[#E2E8EA]">{l}</button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function DashboardB() {
  const { data: d, isLoading, refetch } = useDashboard();
  const openNew = useUI((s) => s.setNewBuild);
  return (
    <div className="mx-auto max-w-[1672px] px-4 sm:px-6 xl:px-[32px]">
      {/* hero */}
      <div className="relative xl:h-[210px]">
        <div className="pt-6 xl:absolute xl:left-[11px] xl:top-[25px] xl:pt-0">
          <p className="text-[13px] font-medium uppercase leading-[15px] tracking-[.16em] text-[#44474F]">Franklin D. Roosevelt High School</p>
          <h1 className="font-display-b mt-[8px] whitespace-nowrap text-[40px] leading-[1.05] text-ink-950 sm:text-[56px] sm:leading-[56px]">Build. <span className="text-fdr-red-bright">Code.</span> Compete.</h1>
          <p className="mt-[2px] text-[17px] leading-[22px] text-ink-600 sm:text-[19px]">Your <span className="font-semibold text-ink-900">FDR Robotics</span> engineering hub.</p>
          <div className="mt-[15px] flex flex-wrap gap-[19px]">
            <button onClick={() => openNew(true)} className="btn btn-primary h-[47px] w-[244px] text-[16px] shadow-[0_1px_2px_rgb(200_6_28/.25)]"><Plus size={18} weight="bold" />Start a New Build<ArrowRight size={18} /></button>
            <Link href="/printer" className="btn btn-outline h-[47px] w-[209px] border-[#D9DBDD] text-[16px]"><Printer size={20} />Open 3D Printer</Link>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:absolute xl:left-[clamp(560px,40.6%,646px)] xl:top-[59px] xl:mt-0 xl:flex xl:gap-[12px]">
          <div className="h-[63px] xl:w-[158px]"><BrainStat variant="b" /></div>
          <div className="h-[63px] xl:w-[158px]"><PrinterStat variant="b" d={d} /></div>
          <div className="h-[63px] xl:w-[162px]"><QueueStat variant="b" d={d} /></div>
        </div>
        <div aria-hidden className="pointer-events-none absolute right-[-32px] top-0 hidden h-[184px] w-[min(532px,33.2%)] overflow-hidden xl:block">
          <HubBanner className="h-full w-full" />
          <div className="absolute left-[75.2%] top-[19px] whitespace-nowrap text-[12px] font-semibold leading-[22.5px] tracking-[.3em] text-white">ENGINEER<br />COLLABORATE<br />INNOVATE<br />COMPETE</div>
          <div className="absolute left-[75.2%] top-[118px] h-1 w-[34px] bg-fdr-red" />
        </div>
        <div aria-hidden className="pointer-events-none absolute right-[324px] top-[146px] hidden text-center min-[1600px]:block">
          <p className="whitespace-nowrap text-[17px] italic leading-[22px] text-ink-800">“Same Cougars. Higher Goals.”</p>
          <p className="mt-[6px] text-[11px] font-medium tracking-[.2em] text-ink-500">FDRHS ROBOTICS</p>
        </div>
      </div>
      {/* main row */}
      <div className="mt-6 grid gap-[13.5px] xl:mt-0 xl:grid-cols-[864fr_355fr_363fr]">
        {isLoading || !d ? <Skeleton className="h-[480px] rounded-[12px]" /> : d.build ? <ActiveBuildB d={d} /> : <section className="card flex h-[480px] items-center justify-center rounded-[12px]"><EmptyState icon={<Cube size={40} />} text="No active build yet" action={<button className="btn btn-primary h-10 px-4" onClick={() => openNew(true)}><Plus size={16} />Start a New Build</button>} /></section>}
        {d ? <QueueB d={d} refresh={() => refetch()} /> : <Skeleton className="h-[480px] rounded-[12px]" />}
        <div className="flex flex-col gap-[13px]">
          {d ? <ActivityB d={d} /> : <Skeleton className="h-[327px] rounded-[12px]" />}
          {d ? <ReadinessB d={d} /> : <Skeleton className="h-[159px] rounded-[12px]" />}
        </div>
      </div>
      {/* workspace */}
      <div className="xl:px-[6px]">
        <h2 className="mb-[6px] mt-5 flex items-center gap-[17px] pl-[10px] text-[16px] font-bold text-ink-900 xl:mt-[-1px]"><GearSix size={20} weight="fill" className="text-fdr-red-bright" />Engineering Workspace</h2>
        {d ? <WorkspaceB d={d} /> : <Skeleton className="h-[132px] rounded-[12px]" />}
      </div>
    </div>
  );
}
