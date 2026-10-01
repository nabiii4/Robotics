'use client';
import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowSquareOut, CaretLeft, PencilSimple, Plus, Star, Trash, X } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { daysUntil } from '@/lib/format';
import { useMe } from '@/components/shell/AppShell';
import { Badge, Donut, Field, Page, Skeleton } from '@/components/ui/bits';
import { toast } from '@/components/ui/Toast';
import { ReadinessChecklist, useReadiness } from '@/components/dashboard/ReadinessDialog';
import { CompetitionDialog, type Comp } from '@/components/competitions/CompetitionDialog';

type Full = Comp & { notes: string | null; packing: { text: string; done: boolean }[]; matchNotes: string | null; results: { rank?: string; awards?: string; notes?: string } | null };

function EventInner({ id }: { id: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { me } = useMe();
  const q = useQuery({ queryKey: ['competition', id], queryFn: () => api.get<{ competition: Full }>(`/api/competitions/${id}`) });
  const rd = useReadiness(id);
  const c = q.data?.competition;
  const tab = ['checklist', 'packing', 'notes', 'results'].includes(sp.get('tab') ?? '') ? sp.get('tab')! : 'checklist';
  const [editing, setEditing] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [notes, setNotes] = useState<string | null>(null);
  const [results, setResults] = useState({ rank: '', awards: '', notes: '' });
  useEffect(() => { if (c?.results) setResults({ rank: c.results.rank ?? '', awards: c.results.awards ?? '', notes: c.results.notes ?? '' }); }, [c?.results]);
  const patch = async (body: Partial<Full>, ok?: string) => { try { await api.patch(`/api/competitions/${id}`, body); qc.invalidateQueries({ queryKey: ['competition', id] }); qc.invalidateQueries({ queryKey: ['competitions'] }); if (ok) toast.ok(ok); } catch (e) { toast.error('Could not save', (e as ClientError).message); } };
  const del = async () => { if (!confirm(`Delete ${c?.name}?`)) return; try { await api.del(`/api/competitions/${id}`); qc.invalidateQueries({ queryKey: ['competitions'] }); router.push('/competitions'); } catch (e) { toast.error('Could not delete', (e as ClientError).message); } };
  if (q.isError) return <Page><p className="text-[14px] text-ink-500">That event doesn’t exist. <Link href="/competitions" className="font-semibold text-fdr-red underline">Back</Link></p></Page>;
  if (!c) return <Page><Skeleton className="h-64 rounded-[10px]" /></Page>;
  const captain = me.role !== 'member';
  const d = daysUntil(c.startDate);
  const setTab = (t: string) => router.replace(`/competitions/${id}?tab=${t}`, { scroll: false });
  return (
    <Page>
      <Link href="/competitions" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink-900"><CaretLeft size={14} />Competitions</Link>
      <div className="card mb-5 flex flex-wrap items-center gap-5 rounded-[10px] p-5">
        <Donut value={(rd.data?.percent ?? 0) / 100} size={92}><span className="tabular text-[20px] font-extrabold">{rd.data?.percent ?? 0}%</span><span className="text-[10px] text-ink-500">ready</span></Donut>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="font-display-b text-[26px] leading-tight text-ink-950">{c.name}</h1>{c.isTarget && <Badge tone="red">★ Target</Badge>}<Badge tone="grey">{c.program === 'VEXU' ? 'VEX U' : c.program === 'VAIRC' ? 'VEX AI' : 'V5RC'}</Badge></div>
          <div className="mt-1 text-[13.5px] text-ink-600">{c.shortName} · {new Date(c.startDate + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}{c.endDate && c.endDate !== c.startDate ? ` – ${new Date(c.endDate + 'T12:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}` : ''}{d >= 0 && <b className="text-fdr-red"> · {d === 0 ? 'today' : `in ${d} days`}</b>}</div>
          {c.location && <div className="text-[13px] text-ink-500">{c.location}</div>}
          {c.notes && <p className="mt-2 text-[13px] text-ink-700">{c.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="btn btn-outline h-9 text-[13px]">RobotEvents<ArrowSquareOut size={14} /></a>}
          {captain && !c.isTarget && <button className="btn btn-outline h-9 text-[13px]" onClick={async () => { await api.post(`/api/competitions/${id}/target`); qc.invalidateQueries({ queryKey: ['competition', id] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); toast.ok('Set as target'); }}><Star size={14} />Set target</button>}
          {captain && <button className="btn btn-outline h-9 text-[13px]" onClick={() => setEditing(true)}><PencilSimple size={14} />Edit</button>}
          {captain && <button aria-label="Delete event" className="btn btn-outline h-9 w-9 p-0 text-fdr-red" onClick={del}><Trash size={15} /></button>}
        </div>
      </div>
      <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
        {([['checklist', 'Readiness'], ['packing', 'Packing list'], ['notes', 'Match notes'], ['results', 'Results']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`border-b-[3px] px-3 pb-2 text-[14px] font-semibold ${tab === k ? 'border-fdr-red text-fdr-red' : 'border-transparent text-ink-600 hover:text-ink-900'}`}>{l}</button>)}
      </div>
      {tab === 'checklist' && (rd.data ? (rd.data.tasks.length ? <div className="card rounded-[10px] p-5"><ReadinessChecklist data={rd.data} /></div> : <p className="text-[13px] text-ink-500">No tasks are linked to this event yet. Add tasks on the <Link href="/team?tab=tasks" className="font-semibold text-fdr-red underline">task board</Link> and pick this competition.</p>) : <Skeleton className="h-40" />)}
      {tab === 'packing' && (
        <div className="card max-w-[640px] rounded-[10px] p-4">
          <ul className="grid gap-1">
            {c.packing.map((p, i) => (
              <li key={i} className="group flex items-center gap-2.5 rounded px-1.5 py-1 hover:bg-[#F6F7F9]">
                <input type="checkbox" checked={p.done} onChange={(e) => patch({ packing: c.packing.map((x, k) => (k === i ? { ...x, done: e.target.checked } : x)) })} className="h-4 w-4 accent-[#1FA84F]" aria-label={p.text} />
                <span className={`flex-1 text-[13.5px] ${p.done ? 'text-ink-400 line-through' : 'text-ink-800'}`}>{p.text}</span>
                <button aria-label={`Remove ${p.text}`} onClick={() => patch({ packing: c.packing.filter((_, k) => k !== i) })} className="text-ink-300 opacity-0 hover:text-fdr-red group-hover:opacity-100"><X size={14} /></button>
              </li>
            ))}
          </ul>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newItem.trim()) { patch({ packing: [...c.packing, { text: newItem.trim(), done: false }] }); setNewItem(''); } }}>
            <input className="input h-9" maxLength={120} value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add an item" /><button className="btn btn-primary h-9"><Plus size={15} />Add</button>
          </form>
          <p className="mt-2 text-[12px] text-ink-400">{c.packing.filter((p) => p.done).length} of {c.packing.length} packed</p>
        </div>
      )}
      {tab === 'notes' && (
        <div className="card rounded-[10px] p-4">
          <textarea className="input min-h-[320px] font-mono text-[13px]" value={notes ?? c.matchNotes ?? ''} onChange={(e) => setNotes(e.target.value)} maxLength={10000} placeholder={'Q12 vs 1234A — they defend the left goal; our auton scored 2.\nQ18 …'} />
          <div className="mt-2 flex items-center gap-2"><button className="btn btn-primary h-9" disabled={notes === null} onClick={async () => { await patch({ matchNotes: notes }, 'Notes saved'); setNotes(null); }}>Save notes</button>{notes !== null && <span className="text-[12px] text-ink-400">Unsaved changes</span>}</div>
        </div>
      )}
      {tab === 'results' && (
        <div className="card grid max-w-[560px] gap-3 rounded-[10px] p-4">
          <Field label="Final rank"><input className="input" maxLength={40} disabled={!captain} value={results.rank} onChange={(e) => setResults({ ...results, rank: e.target.value })} placeholder="e.g. 7th of 36" /></Field>
          <Field label="Awards"><input className="input" maxLength={200} disabled={!captain} value={results.awards} onChange={(e) => setResults({ ...results, awards: e.target.value })} placeholder="e.g. Design Award, Tournament Finalist" /></Field>
          <Field label="What we learned"><textarea className="input min-h-[100px]" maxLength={2000} disabled={!captain} value={results.notes} onChange={(e) => setResults({ ...results, notes: e.target.value })} /></Field>
          {captain && <button className="btn btn-primary h-9 w-fit" onClick={() => patch({ results }, 'Results saved')}>Save results</button>}
        </div>
      )}
      <CompetitionDialog open={editing} onClose={() => setEditing(false)} comp={c} />
    </Page>
  );
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense><EventInner id={id} /></Suspense>;
}
