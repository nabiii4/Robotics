'use client';
import dynamic from 'next/dynamic';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DotsSixVertical, DownloadSimple, Printer as PrinterIcon, Plus, Thermometer, X } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { useUI } from '@/lib/client/stores';
import { timeAgo, hm } from '@/lib/format';
import { Avatar, Badge, EmptyState, Page, PageHeader, Progress, Skeleton, Spinner } from '@/components/ui/bits';
import { Drawer, Dialog } from '@/components/ui/Dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { toast } from '@/components/ui/Toast';
import { usePrinters, fmtDuration, type PrinterView } from '@/components/printer/SendToPrinterDialog';

const MeshViewer = dynamic(() => import('@/components/viewer3d/MeshViewer'), { ssr: false, loading: () => <div className="h-full w-full bg-[#F4F6F8]" /> });

interface JobRow {
  id: string; name: string; material: string; color: string; layer: number; infill: number; quantity: number; status: string; progress: number; remainingSec: number; estSeconds: number; estGrams: number;
  printerId: string | null; printerName: string | null; printerAdapter: string | null; requestedBy: { id: string; name: string; color: string }; customPartId: string | null; uploadId: string | null;
  buildId: string | null; legality: { label: string; tone: 'grey' | 'blue' | 'purple' } | null; startedAt: number | null; finishedAt: number | null; createdAt: number; pickedUp: boolean; notes: string | null; failReason: string | null;
  history: { at: number; status: string; byName: string | null; note?: string }[]; actualSeconds: number | null;
}
const STATUS: Record<string, { label: string; tone: 'red' | 'green' | 'grey' | 'blue' | 'amber' }> = {
  queued: { label: 'Queued', tone: 'grey' }, printing: { label: 'Printing', tone: 'blue' }, paused: { label: 'Paused', tone: 'amber' }, completed: { label: 'Completed', tone: 'green' }, failed: { label: 'Failed', tone: 'red' }, canceled: { label: 'Canceled', tone: 'grey' },
};
const PSTATE: Record<string, { label: string; dot: string }> = { idle: { label: 'Idle', dot: 'bg-ok' }, printing: { label: 'Printing', dot: 'bg-[#1F6FD1]' }, paused: { label: 'Paused', dot: 'bg-warn' }, offline: { label: 'Offline', dot: 'bg-ink-300' } };
const ADAPTER: Record<string, string> = { simulated: 'Simulated', octoprint: 'OctoPrint', moonraker: 'Moonraker' };

function useJobs(tab: string) {
  return useQuery({ queryKey: ['jobs', tab], queryFn: () => api.get<{ jobs: JobRow[]; counts: Record<string, number> }>(`/api/print/jobs?tab=${tab}`), refetchInterval: (q) => ((q.state.data as { jobs: JobRow[] } | undefined)?.jobs.some((j) => j.status === 'printing') ? 4000 : 15000) });
}

function useJobAction() {
  const qc = useQueryClient();
  return async (id: string, action: string, label: string, body?: unknown) => {
    try { await api.post(`/api/print/jobs/${id}/${action}`, body ?? {}); qc.invalidateQueries({ queryKey: ['jobs'] }); qc.invalidateQueries({ queryKey: ['job', id] }); qc.invalidateQueries({ queryKey: ['printers'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok(label); }
    catch (e) { toast.error('That didn’t work', (e as ClientError).message); }
  };
}

function PrinterCard({ p }: { p: PrinterView }) {
  const st = PSTATE[p.state] ?? PSTATE.offline;
  return (
    <div className="card flex min-w-[230px] flex-1 flex-col gap-2 rounded-[10px] p-4">
      <div className="flex items-start justify-between gap-2">
        <div><div className="text-[15px] font-bold text-ink-900">{p.name}</div><div className="text-[12px] text-ink-500">{p.model}</div></div>
        <Badge tone={p.adapter === 'simulated' ? 'grey' : 'blue'}>{ADAPTER[p.adapter]}</Badge>
      </div>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-800"><span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />{st.label}{p.simFrozen && <span className="text-[11px] font-normal text-ink-400">(clock frozen)</span>}</div>
      {p.job ? (
        <div>
          <div className="flex justify-between text-[12.5px]"><span className="truncate text-ink-800">{p.job.name}</span><span className="tabular font-semibold">{Math.round(p.job.progress * 100)}%</span></div>
          <Progress value={p.job.progress} className="mt-1" />
          <div className="mt-1 text-[11.5px] text-ink-500">{hm(p.job.remainingSec)} left</div>
        </div>
      ) : <div className="text-[12.5px] text-ink-400">{p.state === 'offline' ? 'Not reachable' : 'Ready for the next job'}</div>}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-500">
        <span>{p.materials.join(' · ')}</span>
        {p.temps?.nozzle != null && <span className="flex items-center gap-0.5"><Thermometer size={12} />{Math.round(p.temps.nozzle)}° / {Math.round(p.temps.bed ?? 0)}°</span>}
        <span>{p.bedMm.join('×')} mm</span>
      </div>
    </div>
  );
}

function FailDialog({ job, onClose }: { job: JobRow | null; onClose: () => void }) {
  const act = useJobAction();
  const [reason, setReason] = useState('');
  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()} title={`Mark ${job?.name ?? ''} failed`} width={440}
      footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={async () => { if (job) await act(job.id, 'fail', 'Marked failed', { reason }); setReason(''); onClose(); }}>Mark failed</button></>}>
      <select className="input mb-2" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Pick a reason…</option>
        {['Spaghetti / came off the bed', 'Warping', 'Layer shift', 'Clogged nozzle', 'Ran out of filament', 'Wrong size / settings'].map((r) => <option key={r}>{r}</option>)}
      </select>
      <input className="input" placeholder="…or describe it" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
    </Dialog>
  );
}

function JobActions({ j, printers, onFail }: { j: JobRow; printers: PrinterView[]; onFail: (j: JobRow) => void }) {
  const act = useJobAction();
  const qc = useQueryClient();
  const assign = async (printerId: string | null) => { try { await api.patch(`/api/print/jobs/${j.id}`, { printerId }); qc.invalidateQueries({ queryKey: ['jobs'] }); toast.ok(printerId ? 'Printer assigned' : 'Any printer'); } catch (e) { toast.error('Could not assign', (e as ClientError).message); } };
  const active = ['queued', 'printing', 'paused'].includes(j.status);
  return (
    <Menu>
      <MenuTrigger asChild><button aria-label={`${j.name} actions`} onClick={(e) => e.stopPropagation()} className="rounded px-2 py-1 text-[18px] leading-none text-ink-500 hover:bg-black/5 hover:text-ink-900">⋯</button></MenuTrigger>
      <MenuContent width={210}>
        {j.status === 'printing' && <MenuItem onSelect={() => act(j.id, 'pause', 'Paused')}>Pause</MenuItem>}
        {j.status === 'paused' && <MenuItem onSelect={() => act(j.id, 'resume', 'Resumed')}>Resume</MenuItem>}
        {active && <><MenuItem onSelect={() => act(j.id, 'up', 'Moved up')}>Move up</MenuItem><MenuItem onSelect={() => act(j.id, 'down', 'Moved down')}>Move down</MenuItem></>}
        {j.status === 'queued' && <>
          <MenuSeparator />
          <MenuItem onSelect={() => assign(null)}>{!j.printerId ? '✓ ' : ''}Any printer</MenuItem>
          {printers.filter((p) => p.materials.includes(j.material)).map((p) => <MenuItem key={p.id} onSelect={() => assign(p.id)}>{j.printerId === p.id ? '✓ ' : ''}Assign to {p.name}</MenuItem>)}
        </>}
        {j.status === 'completed' && !j.pickedUp && <MenuItem onSelect={() => act(j.id, 'picked-up', 'Marked picked up')}>Mark picked up</MenuItem>}
        <MenuItem onSelect={() => act(j.id, 'reprint', 'Reprint queued')}>Reprint</MenuItem>
        <MenuItem onSelect={() => download(`/api/print/jobs/${j.id}/stl`)}>Download STL</MenuItem>
        {(['printing', 'paused', 'completed'].includes(j.status)) && <MenuItem onSelect={() => onFail(j)}>Mark failed…</MenuItem>}
        {active && <><MenuSeparator /><MenuItem danger onSelect={() => { if (confirm(`Cancel ${j.name}?`)) act(j.id, 'cancel', 'Canceled'); }}>Cancel job</MenuItem></>}
      </MenuContent>
    </Menu>
  );
}

function JobDrawer({ id, onClose, printers, onFail }: { id: string; onClose: () => void; printers: PrinterView[]; onFail: (j: JobRow) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['job', id], queryFn: () => api.get<{ job: JobRow }>(`/api/print/jobs/${id}`), refetchInterval: 5000 });
  const j = q.data?.job;
  const mesh = useQuery({ queryKey: ['job-mesh', j?.customPartId ?? j?.uploadId], queryFn: () => api.get<{ positions: number[]; indices: number[] }>(j!.customPartId ? `/api/parts/${j!.customPartId}/mesh` : `/api/uploads/${j!.uploadId}/mesh`), enabled: !!j && !!(j.customPartId || j.uploadId), staleTime: 300_000 });
  const [notes, setNotes] = useState<string | null>(null);
  const saveNotes = async () => { if (notes === null || !j) return; try { await api.patch(`/api/print/jobs/${j.id}`, { notes }); qc.invalidateQueries({ queryKey: ['job', id] }); toast.ok('Notes saved'); setNotes(null); } catch (e) { toast.error('Could not save', (e as ClientError).message); } };
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} title="Print job" width={520}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="min-w-0"><div className="truncate text-[16px] font-bold text-ink-900">{j?.name ?? 'Print job'}</div>{j && <div className="text-[12px] text-ink-500">Requested by {j.requestedBy.name} · {timeAgo(j.createdAt)}</div>}</div>
        <div className="flex items-center gap-1">{j && <JobActions j={j} printers={printers} onFail={onFail} />}<button aria-label="Close" onClick={onClose} className="rounded-md p-1.5 text-ink-500 hover:bg-black/5"><X size={18} /></button></div>
      </div>
      {!j ? <div className="p-6"><Spinner /></div> : (
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="h-[200px] overflow-hidden rounded-[8px] border border-line">{mesh.data ? <MeshViewer positions={mesh.data.positions} indices={mesh.data.indices} color={j.color} className="h-full w-full" /> : <div className="flex h-full items-center justify-center bg-[#F4F6F8]"><Spinner /></div>}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/print/jobs/${j.id}/thumb.png?size=lg`} alt={`${j.name} render`} className="h-[200px] w-full rounded-[8px] border border-line bg-[#F4F6F8] object-contain" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone={STATUS[j.status]?.tone}>{STATUS[j.status]?.label}</Badge>{j.legality && <Badge tone={j.legality.tone}>{j.legality.label}</Badge>}{j.printerAdapter === 'simulated' && <Badge tone="grey">Simulated printer</Badge>}{j.pickedUp && <Badge tone="green">Picked up</Badge>}</div>
          {(j.status === 'printing' || j.status === 'paused') && <div className="mt-3"><Progress value={j.progress} /><div className="mt-1 flex justify-between text-[12px] text-ink-500"><span>{Math.round(j.progress * 100)}%</span><span>{hm(j.remainingSec)} left</span></div></div>}
          {j.failReason && <div className="mt-3 rounded-md bg-[#FFF5F5] px-3 py-2 text-[12.5px] text-fdr-red">Failed: {j.failReason}</div>}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
            {[['Material', `${j.material} · ${j.color}`], ['Layer / infill', `${j.layer} mm · ${j.infill}%`], ['Quantity', String(j.quantity)], ['Printer', j.printerName ?? 'Next available'], ['Estimate', `${fmtDuration(j.estSeconds)} · ${j.estGrams} g (est.)`], ['Actual', j.actualSeconds ? fmtDuration(j.actualSeconds) : '—']].map(([k, v]) => <div key={k}><dt className="text-ink-400">{k}</dt><dd className="font-medium text-ink-900">{v}</dd></div>)}
          </dl>
          <h3 className="mb-1 mt-5 text-[12px] font-bold uppercase tracking-wider text-ink-500">Notes</h3>
          <textarea className="input min-h-[70px] text-[13px]" value={notes ?? j.notes ?? ''} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="Add a note for whoever picks this up" />
          {notes !== null && <button className="btn btn-primary mt-2 h-8 text-[12px]" onClick={saveNotes}>Save notes</button>}
          <h3 className="mb-1 mt-5 text-[12px] font-bold uppercase tracking-wider text-ink-500">History</h3>
          <ol className="relative ml-2 border-l border-line pl-4">
            {[...j.history].reverse().map((h, i) => <li key={i} className="mb-2 text-[12.5px]"><span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-ink-300" /><b className="text-ink-900">{STATUS[h.status]?.label ?? h.status.replace('_', ' ')}</b>{h.byName && <span className="text-ink-500"> by {h.byName}</span>}{h.note && <span className="text-ink-500"> — {h.note}</span>}<div className="text-[11.5px] text-ink-400">{new Date(h.at).toLocaleString('en-US')}</div></li>)}
          </ol>
          <button className="btn btn-outline mt-3 h-8 text-[12px]" onClick={() => download(`/api/print/jobs/${j.id}/stl`)}><DownloadSimple size={14} />Download STL</button>
        </div>
      )}
    </Drawer>
  );
}

function PrinterInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const openSend = useUI((s) => s.openSendToPrinter);
  const tab = ['active', 'completed', 'failed'].includes(sp.get('tab') ?? '') ? sp.get('tab')! : 'active';
  const jobId = sp.get('job');
  const printers = usePrinters();
  const jobs = useJobs(tab);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [failJob, setFailJob] = useState<JobRow | null>(null);
  const setParam = (k: string, v: string | null) => { const q = new URLSearchParams(sp.toString()); if (v) q.set(k, v); else q.delete(k); router.replace(`/printer?${q.toString()}`, { scroll: false }); };
  const rows = (jobs.data?.jobs ?? []).slice().sort((a, b) => (order ? order.indexOf(a.id) - order.indexOf(b.id) : 0));
  const drop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = rows.map((r) => r.id);
    ids.splice(ids.indexOf(dragId), 1);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setOrder(ids); setDragId(null);
    try { await api.post('/api/print/reorder', { ids }); await qc.invalidateQueries({ queryKey: ['jobs'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); } catch (e) { toast.error('Could not reorder', (e as ClientError).message); }
    setOrder(null);
  };
  const c = jobs.data?.counts;
  return (
    <Page>
      <PageHeader title="3D Printer" subtitle="Printers, the shared queue, and every part the team has printed." actions={<button className="btn btn-primary h-10 px-4" onClick={() => openSend()}><Plus size={16} />Send to Printer</button>} />
      <div className="mb-6 flex flex-wrap gap-3" id="printers">
        {printers.isLoading ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-[150px] min-w-[230px] flex-1 rounded-[10px]" />) : printers.data?.printers.length ? printers.data.printers.map((p) => <PrinterCard key={p.id} p={p} />) : <div className="card w-full rounded-[10px] py-8"><EmptyState icon={<PrinterIcon size={36} />} text="No printers yet — an admin can add one in Settings → Printers." /></div>}
      </div>
      <section className="card rounded-[10px]">
        <div className="flex gap-1 border-b border-line px-3 pt-2" role="tablist">
          {([['active', 'Active'], ['completed', 'Completed'], ['failed', 'Failed / Canceled']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParam('tab', k)} className={`border-b-[3px] px-3 pb-2 pt-1 text-[13.5px] font-semibold ${tab === k ? 'border-fdr-red text-fdr-red' : 'border-transparent text-ink-600 hover:text-ink-900'}`}>{l}{c && <span className="ml-1.5 rounded-full bg-[#F0F1F3] px-1.5 text-[11px] text-ink-600">{c[k]}</span>}</button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-[12.5px]">
            <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr className="border-b border-line">
              <th className="w-8" /><th className="w-16 py-2" /><th className="py-2 font-semibold">Job</th><th className="font-semibold">Material</th><th className="font-semibold">Qty</th><th className="font-semibold">Printer</th><th className="font-semibold">Requested by</th><th className="font-semibold">Status</th><th className="w-[150px] font-semibold">Progress</th><th className="font-semibold">{tab === 'active' ? 'Time left' : 'Finished'}</th><th className="w-10" />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {jobs.isLoading && <tr><td colSpan={11} className="py-8 text-center"><Spinner /></td></tr>}
              {!jobs.isLoading && !rows.length && <tr><td colSpan={11}><EmptyState icon={<PrinterIcon size={32} />} text={tab === 'active' ? 'Nothing in the queue.' : 'Nothing here yet.'} action={tab === 'active' ? <button className="btn btn-primary h-9 px-3" onClick={() => openSend()}>Send to Printer</button> : undefined} /></td></tr>}
              {rows.map((j) => (
                <tr key={j.id} onClick={() => setParam('job', j.id)} className={`cursor-pointer hover:bg-[#FAFBFC] ${dragId === j.id ? 'opacity-40' : ''}`}
                  draggable={tab === 'active'} onDragStart={(e) => { setDragId(j.id); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => { if (dragId) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); drop(j.id); }} onDragEnd={() => setDragId(null)}>
                  <td className="pl-2 text-ink-300">{tab === 'active' && <DotsSixVertical size={16} className="cursor-grab" aria-label="Drag to reorder" />}</td>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <td className="py-1.5"><img src={`/api/print/jobs/${j.id}/thumb.png`} alt="" className="h-11 w-14 rounded-md bg-[#F4F6F8] object-contain" /></td>
                  <td className="font-semibold text-ink-900">{j.name}{j.legality && <div><Badge tone={j.legality.tone} className="mt-0.5 scale-90 origin-left">{j.legality.label}</Badge></div>}</td>
                  <td className="text-ink-600">{j.material} · {j.layer}mm</td>
                  <td className="tabular">{j.quantity}</td>
                  <td className="text-ink-600">{j.printerName ?? <span className="text-ink-400">Next available</span>}</td>
                  <td><span className="flex items-center gap-1.5"><Avatar user={{ name: j.requestedBy.name, color: j.requestedBy.color }} size={22} />{j.requestedBy.name.split(' ')[0]}</span></td>
                  <td><Badge tone={STATUS[j.status]?.tone}>{STATUS[j.status]?.label}</Badge></td>
                  <td className="pr-4">{j.status === 'printing' || j.status === 'paused' ? <div className="flex items-center gap-2"><Progress value={j.progress} className="flex-1" /><span className="tabular w-9 text-right">{Math.round(j.progress * 100)}%</span></div> : j.status === 'completed' ? <span className="text-ok">100%</span> : <span className="text-ink-400">—</span>}</td>
                  <td className="tabular text-ink-600">{tab === 'active' ? (j.status === 'queued' ? `~${fmtDuration(j.estSeconds)}` : hm(j.remainingSec)) : j.finishedAt ? timeAgo(j.finishedAt) : '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}><JobActions j={j} printers={printers.data?.printers ?? []} onFail={setFailJob} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {jobId && <JobDrawer id={jobId} onClose={() => setParam('job', null)} printers={printers.data?.printers ?? []} onFail={setFailJob} />}
      <FailDialog job={failJob} onClose={() => setFailJob(null)} />
    </Page>
  );
}

export default function PrinterPage() {
  return <Suspense><PrinterInner /></Suspense>;
}
