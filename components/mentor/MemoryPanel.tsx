'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, Check, PencilSimple, Plus, PushPin, Trash, X } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { timeAgo } from '@/lib/format';
import { Spinner } from '../ui/bits';
import { toast } from '../ui/Toast';

export interface Memory { id: string; category: string; text: string; importance: number; pinned: boolean; createdAt: number; updatedAt: number; lastUsedAt: number | null }
export const MEM_CATS: Record<string, string> = { preference: 'Preferences', skill: 'Skills', goal: 'Goals', project: 'Projects', role: 'Role', struggle: 'Working on' };

export function useMemories() {
  return useQuery({ queryKey: ['memories'], queryFn: () => api.get<{ memories: Memory[] }>('/api/ai/memories') });
}

/** What the mentor remembers about you — pin, edit, forget (spec §12.7). */
export function MemoryPanel({ compact = false, disabled = false }: { compact?: boolean; disabled?: boolean }) {
  const qc = useQueryClient();
  const q = useMemories();
  const [edit, setEdit] = useState<{ id: string; text: string } | null>(null);
  const [adding, setAdding] = useState<{ category: string; text: string } | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['memories'] });
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); refresh(); if (ok) toast.ok(ok); } catch (e) { toast.error('That didn’t work', (e as ClientError).message); } };
  const mems = q.data?.memories ?? [];
  const groups = Object.keys(MEM_CATS).map((c) => [c, mems.filter((m) => m.category === c).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.importance - a.importance)] as const).filter(([, l]) => l.length);
  return (
    <div className={compact ? '' : 'grid gap-3'}>
      {disabled && <p className="mb-2 rounded-md bg-[#FFF8E1] px-3 py-2 text-[12px] text-[#6B4E00]">Memory is off — the mentor won’t learn or use these notes until you turn it back on in Settings.</p>}
      {q.isLoading ? <Spinner /> : !mems.length ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-[12.5px] text-ink-500"><Brain size={30} className="text-ink-300" />Nothing yet. As you chat, the mentor remembers useful things — your role, what you’re learning, your goals. You’ll see every note here.</div>
      ) : groups.map(([cat, list]) => (
        <section key={cat} className="mb-3">
          <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{MEM_CATS[cat]}</h4>
          <ul className="grid gap-1">
            {list.map((m) => (
              <li key={m.id} className="group rounded-md border border-line bg-white px-2.5 py-2 text-[12.5px]">
                {edit?.id === m.id ? (
                  <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); run(() => api.patch(`/api/ai/memories/${m.id}`, { text: edit.text }), 'Updated').then(() => setEdit(null)); }}>
                    <input autoFocus className="input h-8 py-0 text-[12.5px]" maxLength={200} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} />
                    <button aria-label="Save" className="btn btn-primary h-8 w-8 p-0"><Check size={14} /></button>
                    <button type="button" aria-label="Cancel" onClick={() => setEdit(null)} className="btn btn-outline h-8 w-8 p-0"><X size={14} /></button>
                  </form>
                ) : (
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-ink-800">{m.pinned && <PushPin size={12} weight="fill" className="mr-1 inline text-fdr-red" />}{m.text}<span className="block text-[11px] text-ink-400">{m.lastUsedAt ? `used ${timeAgo(m.lastUsedAt)}` : `saved ${timeAgo(m.createdAt)}`}</span></span>
                    <span className="flex shrink-0 gap-0.5 opacity-60 group-hover:opacity-100">
                      <button aria-label={m.pinned ? 'Unpin' : 'Pin'} title={m.pinned ? 'Unpin' : 'Pin (always used)'} onClick={() => run(() => api.patch(`/api/ai/memories/${m.id}`, { pinned: !m.pinned }))} className="rounded p-1 text-ink-500 hover:bg-black/5"><PushPin size={13} weight={m.pinned ? 'fill' : 'regular'} /></button>
                      <button aria-label="Edit" onClick={() => setEdit({ id: m.id, text: m.text })} className="rounded p-1 text-ink-500 hover:bg-black/5"><PencilSimple size={13} /></button>
                      <button aria-label="Forget" onClick={() => run(() => api.del(`/api/ai/memories/${m.id}`), 'Forgotten')} className="rounded p-1 text-ink-500 hover:bg-black/5 hover:text-fdr-red"><Trash size={13} /></button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {adding ? (
        <form className="grid gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => api.post('/api/ai/memories', adding), 'Saved').then(() => setAdding(null)); }}>
          <select className="input h-8 py-0 text-[12.5px]" value={adding.category} onChange={(e) => setAdding({ ...adding, category: e.target.value })}>{Object.entries(MEM_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input autoFocus className="input h-8 py-0 text-[12.5px]" maxLength={200} placeholder="e.g. I'm the team's main programmer" value={adding.text} onChange={(e) => setAdding({ ...adding, text: e.target.value })} />
          <div className="flex gap-1.5"><button className="btn btn-primary h-8 text-[12px]" disabled={adding.text.trim().length < 5}>Save</button><button type="button" className="btn btn-outline h-8 text-[12px]" onClick={() => setAdding(null)}>Cancel</button></div>
        </form>
      ) : <button className="btn btn-outline h-8 w-fit text-[12px]" onClick={() => setAdding({ category: 'role', text: '' })}><Plus size={13} />Add a note</button>}
    </div>
  );
}
