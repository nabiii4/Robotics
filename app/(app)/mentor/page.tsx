'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Brain, ChatCircleText, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { timeAgo } from '@/lib/format';
import { useMe } from '@/components/shell/AppShell';
import { MentorChat } from '@/components/mentor/Chat';
import { useBuilds, useThreads } from '@/components/mentor/MentorDrawer';
import { MemoryPanel } from '@/components/mentor/MemoryPanel';
import { toast } from '@/components/ui/Toast';
import { BASE } from '@/lib/client/base';

function MentorInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { me, aiMode } = useMe();
  const threads = useThreads();
  const builds = useBuilds();
  const [thread, setThread] = useState<string | null>(sp.get('thread'));
  const [key, setKey] = useState(0);
  const [search, setSearch] = useState('');
  const [rename, setRename] = useState<{ id: string; title: string } | null>(null);
  const [showMem, setShowMem] = useState(true);
  const list = (threads.data?.threads ?? []).filter((t) => !search || t.title.toLowerCase().includes(search.toLowerCase()));
  const current = threads.data?.threads.find((t) => t.id === thread);
  const active = builds.data?.builds.find((b) => b.isTeamActive);
  const [buildId, setBuildId] = useState<string | null>(null);
  useEffect(() => { setBuildId(current ? current.buildId : active?.id ?? null); }, [current, active?.id]);
  const select = (id: string | null) => { setThread(id); setKey((k) => k + 1); router.replace(id ? `/mentor?thread=${id}` : '/mentor', { scroll: false }); };
  const doRename = async () => { if (!rename) return; try { await api.patch(`/api/ai/threads/${rename.id}`, { title: rename.title }); qc.invalidateQueries({ queryKey: ['threads'] }); setRename(null); } catch (e) { toast.error('Could not rename', (e as ClientError).message); } };
  const del = async (id: string) => { if (!confirm('Delete this conversation?')) return; try { await api.del(`/api/ai/threads/${id}`); qc.invalidateQueries({ queryKey: ['threads'] }); if (thread === id) select(null); } catch (e) { toast.error('Could not delete', (e as ClientError).message); } };
  const setThreadBuild = async (b: string | null) => {
    setBuildId(b);
    if (thread) { try { await api.patch(`/api/ai/threads/${thread}`, { buildId: b }); qc.invalidateQueries({ queryKey: ['threads'] }); } catch { /* keeps local choice */ } }
  };
  return (
    <div className="flex h-[calc(100vh-62px)] bg-white">
      <aside className="hidden w-[280px] shrink-0 flex-col border-r border-line md:flex" aria-label="Conversations">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <label className="relative flex-1"><MagnifyingGlass size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input h-9 pl-8 text-[13px]" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
          <button aria-label="New conversation" onClick={() => select(null)} className="btn btn-primary h-9 w-9 p-0"><Plus size={16} /></button>
        </div>
        <ul className="scroll-thin flex-1 overflow-y-auto p-2">
          {list.map((t) => (
            <li key={t.id} className={`group mb-0.5 rounded-md ${thread === t.id ? 'bg-[#FFF0F0]' : 'hover:bg-[#F6F7F9]'}`}>
              {rename?.id === t.id ? (
                <form className="p-1.5" onSubmit={(e) => { e.preventDefault(); doRename(); }}><input autoFocus className="input h-8 text-[13px]" maxLength={80} value={rename.title} onChange={(e) => setRename({ ...rename, title: e.target.value })} onBlur={doRename} onKeyDown={(e) => e.key === 'Escape' && setRename(null)} /></form>
              ) : (
                <div className="flex items-center">
                  <button onClick={() => select(t.id)} className="min-w-0 flex-1 px-2.5 py-2 text-left">
                    <span className={`block truncate text-[13px] ${thread === t.id ? 'font-semibold text-fdr-red' : 'text-ink-900'}`}>{t.title}</span>
                    <span className="block truncate text-[11px] text-ink-400">{t.buildId ? builds.data?.builds.find((b) => b.id === t.buildId)?.name ?? 'Build' : 'General'} · {timeAgo(t.updatedAt)}</span>
                  </button>
                  <button aria-label="Rename" onClick={() => setRename({ id: t.id, title: t.title })} className="rounded p-1 text-ink-400 opacity-0 hover:text-ink-900 group-hover:opacity-100"><PencilSimple size={13} /></button>
                  <button aria-label="Delete" onClick={() => del(t.id)} className="mr-1 rounded p-1 text-ink-400 opacity-0 hover:text-fdr-red group-hover:opacity-100"><Trash size={13} /></button>
                </div>
              )}
            </li>
          ))}
          {threads.data && !list.length && <li className="p-4 text-center text-[12.5px] text-ink-400">{search ? 'No matches.' : 'No conversations yet.'}</li>}
        </ul>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2.5">
          <img src={`${BASE}/brand/mentor-b.png`} alt="" className="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-bold text-ink-900">{current?.title ?? 'New conversation'}</h1>
            <div className="text-[11.5px] text-ink-500">{aiMode.demo ? 'Demo mentor (no AI key set)' : 'AI Build Mentor'}</div>
          </div>
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-600"><ChatCircleText size={15} />About
            <select className="input h-8 w-auto py-0 text-[12.5px]" value={buildId ?? ''} onChange={(e) => setThreadBuild(e.target.value || null)}>
              <option value="">General questions</option>
              {builds.data?.builds.map((b) => <option key={b.id} value={b.id}>{b.name} v{b.version}</option>)}
            </select>
          </label>
          <button aria-pressed={showMem} onClick={() => setShowMem(!showMem)} className="btn btn-outline hidden h-8 text-[12.5px] xl:inline-flex"><Brain size={15} />Memory</button>
        </div>
        <div className="min-h-0 flex-1"><div className="mx-auto h-full max-w-[860px]"><MentorChat key={`${key}-${buildId}`} threadId={thread} onThread={(id) => { setThread(id); router.replace(id ? `/mentor?thread=${id}` : '/mentor', { scroll: false }); }} buildId={buildId} initial={null} /></div></div>
      </main>
      {showMem && (
        <aside className="hidden w-[320px] shrink-0 flex-col border-l border-line bg-[#FAFBFC] xl:flex" aria-label="Memory">
          <div className="border-b border-line px-4 py-3"><h2 className="flex items-center gap-1.5 text-[14px] font-bold text-ink-900"><Brain size={16} className="text-fdr-red" />What the mentor remembers</h2><p className="text-[11.5px] text-ink-500">Only you can see these. Pin, edit or forget anything.</p></div>
          <div className="scroll-thin flex-1 overflow-y-auto p-4"><MemoryPanel disabled={me.prefs.memoryEnabled === false} /></div>
        </aside>
      )}
    </div>
  );
}

export default function MentorPage() {
  return <Suspense><MentorInner /></Suspense>;
}
