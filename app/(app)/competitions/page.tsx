'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarBlank, MapPin, Plus, Star, Trophy } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { daysUntil } from '@/lib/format';
import { useMe } from '@/components/shell/AppShell';
import { Badge, EmptyState, Page, PageHeader, Progress, Skeleton } from '@/components/ui/bits';
import { toast } from '@/components/ui/Toast';
import { CompetitionDialog, type Comp } from '@/components/competitions/CompetitionDialog';

type Row = Comp & { results: { rank?: string; awards?: string; notes?: string } | null; readiness: number | null };
const fmt = (d: string) => new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

export default function CompetitionsPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['competitions'], queryFn: () => api.get<{ competitions: Row[] }>('/api/competitions') });
  const [adding, setAdding] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (q.data?.competitions ?? []).filter((c) => (c.endDate ?? c.startDate) >= today);
  const past = (q.data?.competitions ?? []).filter((c) => (c.endDate ?? c.startDate) < today).reverse();
  const target = async (c: Row) => { try { await api.post(`/api/competitions/${c.id}/target`); qc.invalidateQueries({ queryKey: ['competitions'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['readiness'] }); toast.ok(`${c.shortName} is the target`); } catch (e) { toast.error('Could not set target', (e as ClientError).message); } };
  const captain = me.role !== 'member';
  const Card = ({ c, isPast }: { c: Row; isPast?: boolean }) => {
    const d = daysUntil(c.startDate);
    return (
      <article className={`card flex flex-col gap-2 rounded-[10px] p-4 ${c.isTarget ? 'ring-2 ring-fdr-red' : ''}`}>
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[8px] bg-[#FFF0F0] text-fdr-red">
            {isPast ? <Trophy size={24} /> : <><span className="tabular text-[20px] font-extrabold leading-none">{Math.max(0, d)}</span><span className="text-[10px] font-semibold uppercase">{d === 1 ? 'day' : 'days'}</span></>}
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/competitions/${c.id}`} className="block truncate text-[16px] font-bold text-ink-900 hover:text-fdr-red">{c.name}</Link>
            <div className="flex flex-wrap gap-x-3 text-[12.5px] text-ink-500"><span className="flex items-center gap-1"><CalendarBlank size={13} />{fmt(c.startDate)}</span>{c.location && <span className="flex items-center gap-1"><MapPin size={13} />{c.location}</span>}</div>
          </div>
          {!isPast && captain && <button aria-label={c.isTarget ? 'Target event' : 'Set as target'} aria-pressed={c.isTarget} onClick={() => !c.isTarget && target(c)} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${c.isTarget ? 'bg-fdr-red text-white' : 'bg-[#F0F1F3] text-ink-600 hover:bg-[#E5E7EA]'}`}><Star size={13} weight={c.isTarget ? 'fill' : 'regular'} />Target</button>}
          {!isPast && !captain && c.isTarget && <Badge tone="red">★ Target</Badge>}
        </div>
        {!isPast && c.readiness != null && <div className="flex items-center gap-2"><Progress value={c.readiness / 100} className="flex-1" /><span className="tabular text-[12px] font-semibold">{c.readiness}% ready</span></div>}
        {isPast && (c.results ? <div className="text-[12.5px] text-ink-700">{c.results.rank && <b>Rank {c.results.rank}</b>}{c.results.awards && <span> · {c.results.awards}</span>}</div> : <Link href={`/competitions/${c.id}?tab=results`} className="text-[12.5px] font-semibold text-fdr-red hover:underline">Add results →</Link>)}
      </article>
    );
  };
  return (
    <Page>
      <PageHeader title="Competitions" subtitle="Upcoming events, the target we're preparing for, and how past events went." actions={captain && <button className="btn btn-primary h-10 px-4" onClick={() => setAdding(true)}><Plus size={16} />Add competition</button>} />
      {q.isLoading ? <Skeleton className="h-40 rounded-[10px]" /> : (
        <>
          <h2 className="mb-2 text-[14px] font-bold text-ink-900">Upcoming</h2>
          {upcoming.length ? <div className="mb-8 grid gap-3 md:grid-cols-2">{upcoming.map((c) => <Card key={c.id} c={c} />)}</div> : <div className="card mb-8 rounded-[10px] py-6"><EmptyState icon={<Trophy size={32} />} text="No upcoming events. Add the next tournament from RobotEvents." /></div>}
          <h2 className="mb-2 text-[14px] font-bold text-ink-900">Past events</h2>
          {past.length ? <div className="grid gap-3 md:grid-cols-2">{past.map((c) => <Card key={c.id} c={c} isPast />)}</div> : <p className="text-[13px] text-ink-500">No past events yet.</p>}
        </>
      )}
      <CompetitionDialog open={adding} onClose={() => setAdding(false)} />
    </Page>
  );
}
