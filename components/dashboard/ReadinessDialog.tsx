'use client';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ClientError } from '@/lib/client/api';
import { useUI } from '@/lib/client/stores';
import { daysUntil } from '@/lib/format';
import { Dialog } from '../ui/Dialog';
import { Avatar, Donut, Skeleton, StatusDot } from '../ui/bits';
import { toast } from '../ui/Toast';

export interface ReadinessData {
  percent: number;
  categories: { key: string; label: string; state: string; done: number; total: number }[];
  target: { id: string; name: string; shortName: string; startDate: string } | null;
  tasks: { id: string; title: string; category: string; status: 'todo' | 'doing' | 'done'; weight: number; dueDate: string | null; assignee: { id: string; displayName: string; avatarColor: string } | null }[];
}

export function useReadiness(competitionId?: string | null, enabled = true) {
  return useQuery({ queryKey: ['readiness', competitionId ?? 'target'], queryFn: () => api.get<ReadinessData>(`/api/readiness${competitionId ? `?competition=${competitionId}` : ''}`), enabled });
}

/** Tasks grouped by category with done toggles; shared by the modal and the competition page. */
export function ReadinessChecklist({ data, compact = false }: { data: ReadinessData; compact?: boolean }) {
  const qc = useQueryClient();
  const toggle = async (id: string, done: boolean) => {
    try {
      await api.patch(`/api/tasks/${id}`, { status: done ? 'done' : 'todo' });
      qc.invalidateQueries({ queryKey: ['readiness'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['tasks'] });
    } catch (e) { toast.error('Could not update the task', (e as ClientError).message); }
  };
  const cats = [...data.categories, { key: 'notebook', label: 'Notebook (not counted)', state: '', done: 0, total: 0 }];
  return (
    <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
      {cats.map((c) => {
        const ts = data.tasks.filter((t) => t.category === c.key);
        if (!ts.length) return null;
        return (
          <section key={c.key}>
            <h3 className="mb-1.5 flex items-center justify-between text-[13px] font-bold text-ink-900">
              <span className="flex items-center gap-2">{c.key !== 'notebook' && <StatusDot state={c.state === 'complete' ? 'complete' : c.state === 'in_progress' ? 'in_progress' : 'planned'} size={14} />}{c.label}</span>
              <span className="tabular text-[12px] font-medium text-ink-500">{ts.filter((t) => t.status === 'done').length}/{ts.length}</span>
            </h3>
            <ul className="grid gap-0.5">
              {ts.map((t) => (
                <li key={t.id}>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-1.5 py-1 hover:bg-[#F6F7F9]">
                    <input type="checkbox" checked={t.status === 'done'} onChange={(e) => toggle(t.id, e.target.checked)} className="h-4 w-4 accent-[#1FA84F]" />
                    <span className={`min-w-0 flex-1 truncate text-[13px] ${t.status === 'done' ? 'text-ink-400 line-through' : 'text-ink-800'}`}>{t.title}</span>
                    {t.status === 'doing' && <span className="rounded bg-[#FFF6D6] px-1.5 text-[10.5px] font-semibold text-[#9A6B00]">DOING</span>}
                    {t.assignee && <Avatar user={t.assignee} size={20} />}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function ReadinessDialog() {
  const { readiness: open, setReadiness } = useUI();
  const q = useReadiness(null, open);
  const d = q.data;
  const days = d?.target ? daysUntil(d.target.startDate) : null;
  return (
    <Dialog open={open} onOpenChange={setReadiness} title="Competition Readiness" description={d?.target ? `${d.target.name}${days != null ? ` · ${days > 0 ? `in ${days} days` : days === 0 ? 'today' : 'past'}` : ''}` : 'Tasks for the active build'} width={720}
      footer={d?.target ? <Link href={`/competitions/${d.target.id}?tab=checklist`} onClick={() => setReadiness(false)} className="btn btn-outline">Open event page</Link> : <Link href="/team?tab=tasks" onClick={() => setReadiness(false)} className="btn btn-outline">Open task board</Link>}>
      {!d ? <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-40" /></div> : (
        <div className="grid gap-5">
          <div className="flex items-center gap-5">
            <Donut value={d.percent / 100} size={96}><span className="tabular text-[22px] font-extrabold text-ink-900">{d.percent}%</span></Donut>
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
              {d.categories.map((c) => (
                <div key={c.key} className="rounded-[8px] border border-line px-3 py-2">
                  <div className="text-[12px] font-semibold text-ink-500">{c.label}</div>
                  <div className="tabular text-[16px] font-bold text-ink-900">{c.done}/{c.total}</div>
                </div>
              ))}
            </div>
          </div>
          {d.tasks.length ? <ReadinessChecklist data={d} /> : <p className="text-[13px] text-ink-500">No tasks yet. Add tasks on the <Link href="/team?tab=tasks" className="font-semibold text-fdr-red underline" onClick={() => setReadiness(false)}>task board</Link>.</p>}
        </div>
      )}
    </Dialog>
  );
}
