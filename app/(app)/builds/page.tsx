'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MagnifyingGlass, Plus, Star, Cube, ArrowCounterClockwise, SquaresFour, Blueprint } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { useUI } from '@/lib/client/stores';
import { timeAgo } from '@/lib/format';
import { useMe } from '@/components/shell/AppShell';
import { useBuilds } from '@/components/mentor/MentorDrawer';
import { BuildMenu, PROGRAM, STATUS_TONE } from '@/components/builds/BuildMenu';
import { Badge, EmptyState, Page, PageHeader, Progress, Segmented, Skeleton } from '@/components/ui/bits';
import { toast } from '@/components/ui/Toast';
import { STATUS_LABEL } from '@/components/dashboard/shared';
import { BASE } from '@/lib/client/base';

function BuildsInner() {
  const { me } = useMe();
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useBuilds();
  const setNew = useUI((s) => s.setNewBuild);
  const [who, setWho] = useState<'all' | 'mine' | 'team'>('all');
  const [status, setStatus] = useState('');
  const [program, setProgram] = useState('');
  const [search, setSearch] = useState('');
  const view = sp.get('view') === 'blueprints' ? 'blueprints' : 'cards';
  const deleted = useQuery({ queryKey: ['builds', 'deleted'], queryFn: () => api.get<{ builds: { id: string; name: string; deletedAt: number }[] }>('/api/builds?deleted=1') });
  const list = useMemo(() => (q.data?.builds ?? []).filter((b) =>
    (who === 'all' || (who === 'mine' ? b.ownerId === me.id : b.visibility === 'team')) &&
    (status ? b.status === status : b.status !== 'archived') && (!program || b.program === program) && (!search || b.name.toLowerCase().includes(search.toLowerCase()))), [q.data, who, status, program, search, me.id]);
  const restore = async (id: string) => { try { await api.post(`/api/builds/${id}/restore`); qc.invalidateQueries({ queryKey: ['builds'] }); toast.ok('Restored'); } catch (e) { toast.error('Could not restore', (e as ClientError).message); } };

  return (
    <Page>
      <PageHeader title="Builds" subtitle="Every robot design the team is working on — open one to see its model, blueprints, code and parts."
        actions={<>
          <Segmented value={view} onChange={(v) => router.replace(v === 'blueprints' ? '/builds?view=blueprints' : '/builds')} options={[{ value: 'cards', label: <span className="flex items-center gap-1.5"><SquaresFour size={15} />Cards</span> }, { value: 'blueprints', label: <span className="flex items-center gap-1.5"><Blueprint size={15} />Blueprints</span> }]} />
          <button className="btn btn-primary h-10 px-4" onClick={() => setNew(true)}><Plus size={16} />Start a New Build</button>
        </>} />
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segmented value={who} onChange={setWho} options={[{ value: 'all', label: 'All' }, { value: 'mine', label: 'Mine' }, { value: 'team', label: 'Team' }]} />
        <select aria-label="Status" className="input h-9 w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status (not archived)</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select aria-label="Program" className="input h-9 w-auto" value={program} onChange={(e) => setProgram(e.target.value)}>
          <option value="">All programs</option>
          {Object.entries(PROGRAM).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <label className="relative ml-auto w-full sm:w-64">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input className="input h-9 pl-9" placeholder="Search builds" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
      </div>
      {q.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[300px] rounded-[10px]" />)}</div>
      ) : !list.length ? (
        <div className="card rounded-[10px] py-12"><EmptyState icon={<Cube size={44} />} text={q.data?.builds.length ? 'No builds match these filters.' : 'No builds yet — start one and the mentor can design it for you.'} action={<button className="btn btn-primary h-10 px-4" onClick={() => setNew(true)}><Plus size={16} />Start a New Build</button>} /></div>
      ) : view === 'blueprints' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => (
            <Link key={b.id} href={`/builds/${b.id}?tab=blueprint`} className="card group overflow-hidden rounded-[10px] hover:shadow-[0_10px_28px_rgb(16_24_40/.14)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {b.versionId ? <img src={`${BASE}/api/builds/${b.id}/thumb.svg?style=a&v=${b.versionId}`} alt={`${b.name} blueprint`} className="aspect-[16/10] w-full bg-blueprint-blue object-cover" /> : <div className="aspect-[16/10] bg-blueprint-blue" />}
              <div className="px-4 py-3"><div className="font-mono text-[12px] text-ink-500">{b.drawingPrefix}_v{b.version}</div><div className="text-[15px] font-bold text-ink-900 group-hover:text-fdr-red">{b.name}</div></div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((b) => (
            <article key={b.id} className="card group relative flex flex-col overflow-hidden rounded-[10px] transition-shadow hover:shadow-[0_10px_28px_rgb(16_24_40/.14)]">
              <Link href={`/builds/${b.id}`} className="block" aria-label={`Open ${b.name}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {b.versionId ? <img src={`${BASE}/api/builds/${b.id}/thumb.svg?style=a&v=${b.versionId}`} alt="" className="aspect-[16/9] w-full bg-blueprint-blue object-cover" /> : <div className="aspect-[16/9] bg-blueprint-navy" />}
              </Link>
              {b.isTeamActive && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11.5px] font-bold text-fdr-red shadow"><Star size={13} weight="fill" />Active Build</span>}
              <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Link href={`/builds/${b.id}`} className="block truncate text-[16px] font-bold text-ink-900 hover:text-fdr-red">{b.name}</Link>
                    <div className="truncate text-[12.5px] text-ink-500">{b.tagline || PROGRAM[b.program]}</div>
                  </div>
                  <BuildMenu b={b} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                  <Badge tone="grey">{PROGRAM[b.program]}</Badge>
                  {b.visibility === 'private' && <Badge tone="purple">Private</Badge>}
                </div>
                <div className="text-[12px] text-ink-500">v{b.version} · updated {timeAgo(b.updatedAt)}{b.updatedBy ? ` by ${b.updatedBy}` : ''}</div>
                <div className="mt-auto flex items-center gap-2 pt-1">
                  <Progress value={b.readiness ?? 0} className="flex-1" />
                  <span className="tabular w-10 text-right text-[12px] font-semibold text-ink-700">{b.readiness == null ? '—' : `${Math.round(b.readiness * 100)}%`}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {!!deleted.data?.builds.length && (
        <section className="mt-8">
          <h2 className="mb-2 text-[14px] font-bold text-ink-900">Recently deleted</h2>
          <ul className="card divide-y divide-line rounded-[10px]">
            {deleted.data.builds.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="flex-1 text-ink-800">{b.name}</span>
                <span className="text-ink-400">deleted {timeAgo(b.deletedAt)} · removed after 30 days</span>
                <button className="btn btn-outline h-8 text-[12px]" onClick={() => restore(b.id)}><ArrowCounterClockwise size={14} />Restore</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Page>
  );
}

export default function BuildsPage() {
  return <Suspense><BuildsInner /></Suspense>;
}
