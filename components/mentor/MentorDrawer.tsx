'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowSquareOut, CaretDown, ChatCircleText, Plus, X } from '@phosphor-icons/react';
import { api } from '@/lib/client/api';
import { useMentor } from '@/lib/client/stores';
import { Drawer } from '../ui/Dialog';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '../ui/Menu';
import { MentorChat } from './Chat';

export interface BuildListItem { id: string; name: string; version: number; isTeamActive: boolean; status: string; program: string; tagline: string | null; ownerName: string; updatedAt: number; updatedBy: string; readiness: number | null; visibility: string; versionId: string | null; drawingPrefix: string }

export function useBuilds() {
  return useQuery({ queryKey: ['builds'], queryFn: () => api.get<{ builds: BuildListItem[] }>('/api/builds'), staleTime: 30_000 });
}
export function useThreads(enabled = true) {
  return useQuery({ queryKey: ['threads'], queryFn: () => api.get<{ threads: { id: string; title: string; buildId: string | null; updatedAt: number }[] }>('/api/ai/threads'), enabled });
}

export function MentorDrawer() {
  const { open, close, threadId, setThread, buildId, setBuild, takePending, pending } = useMentor();
  const builds = useBuilds();
  const threads = useThreads(open);
  const [initial, setInitial] = useState<ReturnType<typeof takePending>>(null);
  const [key, setKey] = useState(0);
  const active = builds.data?.builds.find((b) => b.isTeamActive);
  const effectiveBuild = buildId ?? active?.id ?? null;
  const current = builds.data?.builds.find((b) => b.id === effectiveBuild);
  useEffect(() => { if (open && pending) { setInitial(takePending()); setKey((k) => k + 1); } }, [open, pending, takePending]);
  return (
    <Drawer open={open} onOpenChange={(o) => (o ? null : close())} title="AI Build Mentor">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <img src="/brand/mentor-b.png" alt="" className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold text-ink-900">AI Build Mentor</div>
          <Menu>
            <MenuTrigger asChild>
              <button className="flex max-w-full items-center gap-1 truncate text-[12px] text-ink-500 hover:text-ink-900">
                <ChatCircleText size={13} />{threads.data?.threads.find((t) => t.id === threadId)?.title ?? 'New conversation'}<CaretDown size={11} />
              </button>
            </MenuTrigger>
            <MenuContent align="start" width={280}>
              <MenuItem onSelect={() => { setThread(null); setInitial(null); setKey((k) => k + 1); }}><Plus size={15} />New conversation</MenuItem>
              <MenuSeparator />
              <MenuLabel>Recent</MenuLabel>
              {(threads.data?.threads ?? []).slice(0, 12).map((t) => <MenuItem key={t.id} onSelect={() => { setThread(t.id); setInitial(null); setKey((k) => k + 1); }}><span className="truncate">{t.title}</span></MenuItem>)}
            </MenuContent>
          </Menu>
        </div>
        <Link href={threadId ? `/mentor?thread=${threadId}` : '/mentor'} onClick={close} aria-label="Open full page" className="rounded-md p-1.5 text-ink-500 hover:bg-[#F3F4F6] hover:text-ink-900"><ArrowSquareOut size={18} /></Link>
        <button aria-label="Close" onClick={close} className="rounded-md p-1.5 text-ink-500 hover:bg-[#F3F4F6] hover:text-ink-900"><X size={18} /></button>
      </div>
      <div className="border-b border-line px-4 py-2">
        <Menu>
          <MenuTrigger asChild>
            <button className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full bg-[#F2F4F5] px-3 py-1 text-[12px] font-medium text-ink-800 hover:bg-[#E8EBED]">
              {current ? <>Designing: <b className="font-semibold">{current.name} v{current.version}</b></> : 'No build selected'}<CaretDown size={11} />
            </button>
          </MenuTrigger>
          <MenuContent align="start" width={280}>
            <MenuLabel>Mentor works on…</MenuLabel>
            {(builds.data?.builds ?? []).map((b) => <MenuItem key={b.id} onSelect={() => setBuild(b.id)}>{b.name} <span className="text-ink-400">v{b.version}</span>{b.isTeamActive && <span className="ml-auto text-[11px] text-fdr-red">Active</span>}</MenuItem>)}
            <MenuSeparator />
            <MenuItem onSelect={() => setBuild(null)}>No build (general questions)</MenuItem>
          </MenuContent>
        </Menu>
      </div>
      <div className="min-h-0 flex-1">
        <MentorChat key={key} threadId={threadId} onThread={setThread} buildId={effectiveBuild} initial={initial} />
      </div>
    </Drawer>
  );
}
