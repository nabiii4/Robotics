'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash, UsersThree } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { timeAgo } from '@/lib/format';
import { useMe } from '@/components/shell/AppShell';
import { useBuilds } from '@/components/mentor/MentorDrawer';
import { Avatar, Badge, EmptyState, Field, Page, PageHeader, Skeleton, Spinner } from '@/components/ui/bits';
import { Dialog } from '@/components/ui/Dialog';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/ui/Menu';
import { toast } from '@/components/ui/Toast';

interface Member { id: string; username: string; displayName: string; avatarText: string | null; avatarColor: string; role: string; teamRole: string; grade: string | null; bio: string | null; skills: string[]; lastActiveAt: number | null; disabled: boolean }
interface Task { id: string; title: string; category: string; status: 'todo' | 'doing' | 'done'; assigneeId: string | null; buildId: string | null; competitionId: string | null; dueDate: string | null; weight: number; assignee: { id: string; displayName: string; avatarColor: string } | null; createdBy: string }
interface Act { id: string; type: string; createdAt: number; actor: { id: string; name: string; initial: string; color: string } | null; parts: { t: string; link?: string; underline?: boolean; strong?: boolean }[]; href: string }
const TEAM_ROLES = ['Builder', 'Programmer', 'Driver', 'Designer', 'Notebook', 'Captain', 'Coach'];
const CATS: Record<string, { label: string; tone: 'red' | 'blue' | 'purple' | 'amber' | 'green' }> = { mechanical: { label: 'Mechanical', tone: 'red' }, electronics: { label: 'Electronics', tone: 'amber' }, code: { label: 'Code', tone: 'blue' }, testing: { label: 'Testing', tone: 'green' }, notebook: { label: 'Notebook', tone: 'purple' } };
const COLS: [Task['status'], string][] = [['todo', 'To do'], ['doing', 'Doing'], ['done', 'Done']];

function useMembers() { return useQuery({ queryKey: ['members'], queryFn: () => api.get<{ members: Member[] }>('/api/team/members') }); }

function Roster() {
  const { me } = useMe();
  const qc = useQueryClient();
  const q = useMembers();
  const [temp, setTemp] = useState<{ name: string; pw: string } | null>(null);
  const admin = me.role === 'admin';
  const patch = async (m: Member, body: Record<string, unknown>, ok: string) => { try { await api.patch(`/api/team/members/${m.id}`, body); qc.invalidateQueries({ queryKey: ['members'] }); toast.ok(ok); } catch (e) { toast.error('That didn’t work', (e as ClientError).message); } };
  const reset = async (m: Member) => { if (!confirm(`Reset ${m.displayName}'s password? They'll be signed out everywhere.`)) return; try { const r = await api.post<{ temporaryPassword: string }>(`/api/team/members/${m.id}/reset-password`); setTemp({ name: m.displayName, pw: r.temporaryPassword }); } catch (e) { toast.error('Could not reset', (e as ClientError).message); } };
  if (q.isLoading) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-[10px]" />)}</div>;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {q.data?.members.map((m) => (
          <article key={m.id} className={`card relative flex flex-col gap-2 rounded-[10px] p-4 ${m.disabled ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <Avatar user={m} size={44} />
              <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-bold text-ink-900">{m.displayName}{m.id === me.id && <span className="ml-1 text-[11px] font-medium text-ink-400">(you)</span>}</div><div className="text-[12.5px] text-ink-500">{m.teamRole}{m.grade ? ` · Grade ${m.grade}` : ''}</div></div>
              {admin && (
                <Menu>
                  <MenuTrigger asChild><button aria-label={`Manage ${m.displayName}`} className="rounded px-1.5 text-[18px] leading-none text-ink-500 hover:bg-black/5">⋯</button></MenuTrigger>
                  <MenuContent width={220}>
                    {TEAM_ROLES.map((r) => <MenuItem key={r} onSelect={() => patch(m, { teamRole: r }, `${m.displayName} is now ${r}`)}>{m.teamRole === r ? '✓ ' : ''}{r}</MenuItem>)}
                    <MenuSeparator />
                    {(['member', 'captain', 'admin'] as const).map((r) => <MenuItem key={r} onSelect={() => patch(m, { role: r }, `Access: ${r}`)}>{m.role === r ? '✓ ' : ''}Access: {r}</MenuItem>)}
                    <MenuSeparator />
                    <MenuItem onSelect={() => reset(m)}>Reset password…</MenuItem>
                    <MenuItem danger onSelect={() => patch(m, { disabled: !m.disabled }, m.disabled ? 'Reactivated' : 'Deactivated')}>{m.disabled ? 'Reactivate' : 'Deactivate'}</MenuItem>
                  </MenuContent>
                </Menu>
              )}
            </div>
            <div className="flex flex-wrap gap-1">{m.role !== 'member' && <Badge tone="red">{m.role}</Badge>}{m.disabled && <Badge tone="grey">deactivated</Badge>}{m.skills.map((s) => <span key={s} className="rounded-full bg-[#F0F1F3] px-2 py-0.5 text-[11px] text-ink-700">{s}</span>)}</div>
            {m.bio && <p className="line-clamp-2 text-[12.5px] text-ink-600">{m.bio}</p>}
            <div className="mt-auto text-[11.5px] text-ink-400">{m.lastActiveAt ? `Active ${timeAgo(m.lastActiveAt)}` : 'Not signed in yet'}</div>
          </article>
        ))}
      </div>
      <Dialog open={!!temp} onOpenChange={(o) => !o && setTemp(null)} title="Temporary password" description={`Give this to ${temp?.name}. They must choose a new password when they sign in.`} width={420} footer={<button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(temp?.pw ?? ''); toast.ok('Copied'); }}>Copy</button>}>
        <div className="rounded-md bg-[#F6F7F9] px-4 py-3 text-center font-mono text-[20px] font-bold tracking-wider text-ink-900">{temp?.pw}</div>
        <p className="mt-2 text-[12px] text-ink-500">This is shown once.</p>
      </Dialog>
    </>
  );
}

function TaskDialog({ open, onClose, task, members }: { open: boolean; onClose: () => void; task: Task | null; members: Member[] }) {
  const qc = useQueryClient();
  const builds = useBuilds();
  const comps = useQuery({ queryKey: ['competitions'], queryFn: () => api.get<{ competitions: { id: string; name: string; isTarget: boolean }[] }>('/api/competitions'), enabled: open });
  const blank = { title: '', category: 'mechanical', status: 'todo', assigneeId: '', buildId: '', competitionId: '', dueDate: '', weight: 1 };
  const [f, setF] = useState(blank);
  useEffect(() => {
    if (!open) return;
    if (task) setF({ title: task.title, category: task.category, status: task.status, assigneeId: task.assigneeId ?? '', buildId: task.buildId ?? '', competitionId: task.competitionId ?? '', dueDate: task.dueDate ?? '', weight: task.weight });
    else setF({ ...blank, competitionId: comps.data?.competitions.find((c) => c.isTarget)?.id ?? '', buildId: builds.data?.builds.find((b) => b.isTeamActive)?.id ?? '' });
  }, [open, task]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const body = { ...f, assigneeId: f.assigneeId || null, buildId: f.buildId || null, competitionId: f.competitionId || null, dueDate: f.dueDate || null };
    try { if (task) await api.patch(`/api/tasks/${task.id}`, body); else await api.post('/api/tasks', body); qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['readiness'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); onClose(); }
    catch (e) { toast.error('Could not save the task', (e as ClientError).message); }
  };
  const del = async () => { if (!task || !confirm('Delete this task?')) return; try { await api.del(`/api/tasks/${task.id}`); qc.invalidateQueries({ queryKey: ['tasks'] }); qc.invalidateQueries({ queryKey: ['readiness'] }); onClose(); } catch (e) { toast.error('Could not delete', (e as ClientError).message); } };
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: k === 'weight' ? Number(e.target.value) : e.target.value });
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={task ? 'Edit task' : 'New task'} width={520}
      footer={<>{task && <button className="btn btn-ghost mr-auto text-fdr-red" onClick={del}><Trash size={15} />Delete</button>}<button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.title.trim()} onClick={save}>{task ? 'Save' : 'Add task'}</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="Task"><input autoFocus className="input" maxLength={120} value={f.title} onChange={set('title')} placeholder="e.g. Wire the intake motor" /></Field></div>
        <Field label="Category"><select className="input" value={f.category} onChange={set('category')}>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label="Status"><select className="input" value={f.status} onChange={set('status')}>{COLS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Assignee"><select className="input" value={f.assigneeId} onChange={set('assigneeId')}><option value="">Unassigned</option>{members.filter((m) => !m.disabled).map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select></Field>
        <Field label="Due date"><input className="input" type="date" value={f.dueDate} onChange={set('dueDate')} /></Field>
        <Field label="Build"><select className="input" value={f.buildId} onChange={set('buildId')}><option value="">None</option>{builds.data?.builds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Competition"><select className="input" value={f.competitionId} onChange={set('competitionId')}><option value="">None</option>{comps.data?.competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Weight" hint="Bigger tasks count more toward readiness"><select className="input" value={f.weight} onChange={set('weight')}>{[1, 2, 3, 4, 5].map((w) => <option key={w}>{w}</option>)}</select></Field>
      </div>
    </Dialog>
  );
}

function TaskBoard() {
  const qc = useQueryClient();
  const sp = useSearchParams();
  const members = useMembers();
  const builds = useBuilds();
  const [cat, setCat] = useState('');
  const [who, setWho] = useState('');
  const [build, setBuild] = useState('');
  const [due, setDue] = useState('');
  const q = useQuery({ queryKey: ['tasks'], queryFn: () => api.get<{ tasks: Task[] }>('/api/tasks') });
  const [edit, setEdit] = useState<Task | null>(null);
  const [adding, setAdding] = useState(false);
  const [drag, setDrag] = useState<string | null>(null);
  useEffect(() => { const id = sp.get('task'); if (id && q.data) { const t = q.data.tasks.find((x) => x.id === id); if (t) setEdit(t); } }, [sp, q.data]);
  const today = new Date().toISOString().slice(0, 10);
  const week = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const tasks = useMemo(() => (q.data?.tasks ?? []).filter((t) => (!cat || t.category === cat) && (!who || (who === 'none' ? !t.assigneeId : t.assigneeId === who)) && (!build || t.buildId === build) &&
    (!due || (due === 'overdue' ? t.dueDate && t.dueDate < today && t.status !== 'done' : due === 'week' ? t.dueDate && t.dueDate >= today && t.dueDate <= week : !t.dueDate))), [q.data, cat, who, build, due, today, week]);
  const move = async (id: string, status: Task['status']) => {
    const t = q.data?.tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    qc.setQueryData<{ tasks: Task[] }>(['tasks'], (d) => d && { tasks: d.tasks.map((x) => (x.id === id ? { ...x, status } : x)) });
    try { await api.patch(`/api/tasks/${id}`, { status }); if (status === 'done') toast.ok('Nice work!', t.title); qc.invalidateQueries({ queryKey: ['readiness'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); }
    catch (e) { toast.error('Could not move', (e as ClientError).message); }
    finally { qc.invalidateQueries({ queryKey: ['tasks'] }); }
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select aria-label="Category" className="input h-9 w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select aria-label="Assignee" className="input h-9 w-auto" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option><option value="none">Unassigned</option>{members.data?.members.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select>
        <select aria-label="Build" className="input h-9 w-auto" value={build} onChange={(e) => setBuild(e.target.value)}><option value="">All builds</option>{builds.data?.builds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select aria-label="Due" className="input h-9 w-auto" value={due} onChange={(e) => setDue(e.target.value)}><option value="">Any due date</option><option value="overdue">Overdue</option><option value="week">Due this week</option><option value="none">No due date</option></select>
        <button className="btn btn-primary ml-auto h-9 text-[13px]" onClick={() => setAdding(true)}><Plus size={15} />New task</button>
      </div>
      {q.isLoading ? <Skeleton className="h-80 rounded-[10px]" /> : (
        <div className="grid gap-3 lg:grid-cols-3">
          {COLS.map(([status, label]) => {
            const col = tasks.filter((t) => t.status === status);
            return (
              <section key={status} onDragOver={(e) => { if (drag) e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (drag) move(drag, status); setDrag(null); }} className="flex min-h-[200px] flex-col rounded-[10px] bg-[#EEF0F2] p-2" aria-label={label}>
                <h3 className="flex items-center justify-between px-2 py-1.5 text-[13px] font-bold text-ink-800">{label}<span className="rounded-full bg-white px-2 text-[11.5px] text-ink-500">{col.length}</span></h3>
                <div className="grid gap-2">
                  {col.map((t) => (
                    <button key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragEnd={() => setDrag(null)} onClick={() => setEdit(t)} className={`card cursor-grab rounded-[8px] p-3 text-left hover:shadow-[0_4px_12px_rgb(16_24_40/.1)] ${drag === t.id ? 'opacity-40' : ''}`}>
                      <div className={`text-[13px] font-medium ${t.status === 'done' ? 'text-ink-400 line-through' : 'text-ink-900'}`}>{t.title}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge tone={CATS[t.category]?.tone}>{CATS[t.category]?.label}</Badge>
                        {t.dueDate && <span className={`text-[11px] ${t.dueDate < today && t.status !== 'done' ? 'font-semibold text-fdr-red' : 'text-ink-400'}`}>due {new Date(t.dueDate + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        <span className="ml-auto">{t.assignee ? <Avatar user={t.assignee} size={22} /> : <span className="text-[11px] text-ink-400">—</span>}</span>
                      </div>
                    </button>
                  ))}
                  {!col.length && <p className="px-2 py-4 text-center text-[12px] text-ink-400">Drop tasks here</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <TaskDialog open={adding || !!edit} task={edit} onClose={() => { setAdding(false); setEdit(null); }} members={members.data?.members ?? []} />
    </div>
  );
}

function ActivityFeed() {
  const members = useMembers();
  const [who, setWho] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const q = useInfiniteQuery({
    queryKey: ['activity', who, type, from],
    queryFn: ({ pageParam }) => api.get<{ items: Act[]; next: number | null }>(`/api/activity?limit=25${pageParam ? `&before=${pageParam}` : from ? `&before=${new Date(from + 'T23:59:59').getTime()}` : ''}${who ? `&actor=${who}` : ''}${type ? `&type=${type}` : ''}`),
    initialPageParam: 0 as number, getNextPageParam: (last) => last.next ?? undefined,
  });
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage(); });
    io.observe(el); return () => io.disconnect();
  }, [q]);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Person" className="input h-9 w-auto" value={who} onChange={(e) => setWho(e.target.value)}><option value="">Everyone</option>{members.data?.members.map((m) => <option key={m.id} value={m.id}>{m.displayName}</option>)}</select>
        <select aria-label="Type" className="input h-9 w-auto" value={type} onChange={(e) => setType(e.target.value)}><option value="">All activity</option><option value="build">Builds</option><option value="ai">AI Mentor</option><option value="print">Printing</option><option value="code">Code</option><option value="task">Tasks</option><option value="inventory">Inventory</option><option value="order">Orders</option><option value="file">Files</option></select>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-600">On or before <input type="date" className="input h-9 w-auto" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
      </div>
      <ul className="card divide-y divide-line rounded-[10px]">
        {q.isLoading && <li className="p-4"><Spinner /></li>}
        {items.map((a) => (
          <li key={a.id}><Link href={a.href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#FAFBFC]">
            {a.actor ? <Avatar user={{ name: a.actor.name, color: a.actor.color, initial: a.actor.initial }} size={30} /> : <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-fdr-red text-[11px] font-bold text-white">AI</span>}
            <span className="flex-1 text-[13px] text-ink-800">{a.parts.map((p, i) => <span key={i} className={`${p.strong ? 'font-semibold text-ink-900' : ''} ${p.underline ? 'underline' : ''}`}>{p.t}</span>)}</span>
            <span className="shrink-0 text-[11.5px] text-ink-400">{timeAgo(a.createdAt)}</span>
          </Link></li>
        ))}
        {!q.isLoading && !items.length && <li><EmptyState icon={<UsersThree size={32} />} text="No activity matches." /></li>}
      </ul>
      <div ref={sentinel} className="py-4 text-center">{q.isFetchingNextPage && <Spinner />}</div>
    </div>
  );
}

function TeamInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = ['tasks', 'activity'].includes(sp.get('tab') ?? '') ? sp.get('tab')! : 'roster';
  return (
    <Page>
      <PageHeader title="Team" subtitle="Who's on the team, what everyone is working on, and what just happened." />
      <div className="mb-5 flex gap-1 border-b border-line" role="tablist">
        {([['roster', 'Roster'], ['tasks', 'Task board'], ['activity', 'Activity']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => router.replace(k === 'roster' ? '/team' : `/team?tab=${k}`)} className={`border-b-[3px] px-3 pb-2 text-[14px] font-semibold ${tab === k ? 'border-fdr-red text-fdr-red' : 'border-transparent text-ink-600 hover:text-ink-900'}`}>{l}</button>)}
      </div>
      {tab === 'roster' ? <Roster /> : tab === 'tasks' ? <TaskBoard /> : <ActivityFeed />}
    </Page>
  );
}

export default function TeamPage() {
  return <Suspense><TeamInner /></Suspense>;
}
