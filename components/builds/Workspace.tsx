'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CaretDown, CaretLeft, ChatCircleText, Cube, Eye, FileText, Lock, PencilSimple, Printer, ShieldCheck, Star, Table, Wrench, X, Code } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { timeAgo } from '@/lib/format';
import { useMe } from '../shell/AppShell';
import { useDerived, type Derived } from '../viewer3d/Viewer';
import { STATUS_LABEL, StatusMenu } from '../dashboard/shared';
import { STATUS_TONE } from './BuildMenu';
import { Badge, Skeleton } from '../ui/bits';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from '../ui/Menu';
import { toast } from '../ui/Toast';
import { MentorChat } from '../mentor/Chat';
import { ModelTab } from './ModelTab';
import { BlueprintTab } from './BlueprintTab';
import { AssemblyTab } from './AssemblyTab';
import { SpecsTab } from './SpecsTab';
import { PartsTab } from './PartsTab';
import { RulesTab } from './RulesTab';
import { CodeIDE } from '../code/CodeIDE';
import { BASE } from '@/lib/client/base';

export interface VersionRow { id: string; version: number; source: string; author: string; diff: string[] | null; changeSummary: string[] | null; createdAt: number }
export interface BuildDetail { build: { id: string; name: string; tagline: string | null; status: string; visibility: string; ownerId: string; isTeamActive: boolean; currentVersionId: string | null; program: string; drawingPrefix: string }; versions: VersionRow[] }

const TABS = [
  { key: 'model', label: '3D Model', Icon: Cube },
  { key: 'blueprint', label: 'Blueprint', Icon: FileText },
  { key: 'assembly', label: 'Assembly', Icon: Wrench },
  { key: 'code', label: 'VEX Code', Icon: Code },
  { key: 'specs', label: 'Specs & BOM', Icon: Table },
  { key: 'parts', label: 'Printed Parts', Icon: Printer },
  { key: 'rules', label: 'Rules Check', Icon: ShieldCheck },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const SOURCE: Record<string, string> = { ai: 'AI', user: 'User', template: 'Template', import: 'Import', restore: 'Restore' };

export function useBuildDetail(id: string) {
  return useQuery({ queryKey: ['build', id], queryFn: () => api.get<BuildDetail>(`/api/builds/${id}`) });
}

export function Workspace({ id }: { id: string }) {
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { me, savePrefs } = useMe();
  const tab = (TABS.some((t) => t.key === sp.get('tab')) ? sp.get('tab') : 'model') as TabKey;
  const previewId = sp.get('version');
  const detail = useBuildDetail(id);
  const derived = useDerived(id, previewId);
  const [panel, setPanel] = useState<boolean>(me.prefs.mentorPanelOpen ?? true);
  const [thread, setThread] = useState<string | null>(null);
  const [mentorKey, setMentorKey] = useState(0);
  const [initial, setInitial] = useState<{ text: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  useEffect(() => { if (sp.get('mentor') === '1') setPanel(true); }, [sp]);

  const setTab = (t: TabKey) => { const q = new URLSearchParams(sp.toString()); q.set('tab', t); q.delete('export'); router.replace(`/builds/${id}?${q.toString()}`, { scroll: false }); };
  const togglePanel = (open: boolean) => { setPanel(open); savePrefs({ mentorPanelOpen: open }).catch(() => {}); };
  const askMentor = (text: string) => { setInitial({ text }); setThread(null); setMentorKey((k) => k + 1); togglePanel(true); };
  const refresh = () => { qc.invalidateQueries({ queryKey: ['build', id] }); qc.invalidateQueries({ queryKey: ['derived'] }); qc.invalidateQueries({ queryKey: ['builds'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); };

  if (detail.isError) return <div className="p-10 text-center text-[14px] text-ink-500">{(detail.error as ClientError).status === 404 ? 'That build doesn’t exist or is private.' : (detail.error as Error).message} <Link href="/builds" className="font-semibold text-fdr-red underline">Back to Builds</Link></div>;
  const b = detail.data?.build;
  const d = derived.data;
  const versions = detail.data?.versions ?? [];
  const cur = versions.find((v) => v.id === b?.currentVersionId);
  const previewing = previewId && d && !d.isCurrent ? versions.find((v) => v.id === previewId) : null;

  const saveName = async () => {
    const n = name.trim();
    setEditing(false);
    if (!b || !n || n === b.name) return;
    try { await api.patch(`/api/builds/${id}`, { name: n }); refresh(); } catch (e) { toast.error('Could not rename', (e as ClientError).message); }
  };
  const restore = async (v: VersionRow) => {
    try { const r = await api.post<{ version: number }>(`/api/builds/${id}/versions/${v.id}/restore`); refresh(); router.replace(`/builds/${id}?tab=${tab}`); toast.ok(`Restored as v${r.version}`); }
    catch (e) { toast.error('Could not restore', (e as ClientError).message); }
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); refresh(); toast.ok(ok); } catch (e) { toast.error('That didn’t work', (e as ClientError).message); } };

  return (
    <div className="flex min-h-[calc(100vh-62px)]">
      <div className="min-w-0 flex-1">
        <div className="border-b border-line bg-white px-4 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Link href="/builds" aria-label="Back to Builds" className="rounded-md p-1 text-ink-500 hover:bg-black/5 hover:text-ink-900"><CaretLeft size={18} /></Link>
            {!b ? <Skeleton className="h-8 w-64" /> : editing ? (
              <input autoFocus className="input h-9 w-72 text-[20px] font-bold" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(false); }} />
            ) : (
              <h1 className="group flex items-center gap-2 font-display-b text-[24px] leading-tight text-ink-950">
                {b.name}
                <button aria-label="Rename" onClick={() => { setName(b.name); setEditing(true); }} className="rounded p-1 text-ink-400 opacity-60 hover:bg-black/5 hover:text-ink-900 group-hover:opacity-100"><PencilSimple size={16} /></button>
              </h1>
            )}
            {b && <StatusMenu buildId={id} status={b.status}><button className="inline-flex items-center gap-1"><Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge><CaretDown size={11} className="text-ink-400" /></button></StatusMenu>}
            {b?.isTeamActive && <span className="inline-flex items-center gap-1 text-[12px] font-bold text-fdr-red"><Star size={14} weight="fill" />Active Build</span>}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {b && (
                <Menu>
                  <MenuTrigger asChild><button className="btn btn-outline h-9 text-[13px]">v{d?.version ?? cur?.version ?? '–'}{previewing ? ' (preview)' : ''}<CaretDown size={12} /></button></MenuTrigger>
                  <MenuContent width={340} align="end">
                    <MenuLabel>Version history</MenuLabel>
                    <div className="scroll-thin max-h-[360px] overflow-y-auto">
                      {versions.map((v) => (
                        <div key={v.id} className="rounded-md px-2.5 py-2 hover:bg-[#F6F7F9]">
                          <div className="flex items-center gap-2 text-[13px]">
                            <b className="text-ink-900">v{v.version}</b><Badge tone={v.source === 'ai' ? 'red' : 'grey'}>{SOURCE[v.source] ?? v.source}</Badge>
                            {v.id === b.currentVersionId && <span className="text-[11px] font-semibold text-ok">current</span>}
                            <span className="ml-auto text-[11.5px] text-ink-400">{timeAgo(v.createdAt)}</span>
                          </div>
                          <div className="text-[12px] text-ink-500">{v.author}{(v.changeSummary ?? v.diff)?.[0] ? ` · ${(v.changeSummary ?? v.diff)![0]}` : ''}</div>
                          {v.id !== b.currentVersionId && (
                            <div className="mt-1 flex gap-2">
                              <button className="text-[12px] font-semibold text-ink-700 hover:text-fdr-red" onClick={() => router.replace(`/builds/${id}?tab=${tab}&version=${v.id}`)}>Preview</button>
                              <button className="text-[12px] font-semibold text-fdr-red hover:underline" onClick={() => restore(v)}>Restore</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </MenuContent>
                </Menu>
              )}
              {b && (b.ownerId === me.id || me.role === 'admin') && (
                <button className="btn btn-outline h-9 text-[13px]" onClick={() => act(() => api.patch(`/api/builds/${id}`, { visibility: b.visibility === 'team' ? 'private' : 'team' }), b.visibility === 'team' ? 'Now private (only you)' : 'Shared with the team')}>
                  {b.visibility === 'team' ? <Eye size={15} /> : <Lock size={15} />}{b.visibility === 'team' ? 'Team' : 'Private'}
                </button>
              )}
              {b && !b.isTeamActive && me.role !== 'member' && <button className="btn btn-outline h-9 text-[13px]" onClick={() => act(() => api.post(`/api/builds/${id}/activate`), 'Set as the Active Build')}><Star size={15} />Set Active</button>}
              {b && (
                <Menu>
                  <MenuTrigger asChild><button className="btn btn-outline h-9 text-[13px]">Export<CaretDown size={12} /></button></MenuTrigger>
                  <MenuContent width={230}>
                    <MenuItem onSelect={() => download(`/api/builds/${id}/spec.json`)}>RobotSpec (JSON)</MenuItem>
                    <MenuItem onSelect={() => download(`/api/builds/${id}/bom.csv`)}>BOM (CSV)</MenuItem>
                    <MenuItem onSelect={() => router.replace(`/builds/${id}?tab=blueprint&export=pdf`)}>Blueprint (PDF)</MenuItem>
                    <MenuItem onSelect={() => download(`/api/builds/${id}/parts/stl.zip`)}>Printed parts (STL zip)</MenuItem>
                    <MenuItem onSelect={() => download(`/api/builds/${id}/code/zip`)}>Code (zip)</MenuItem>
                  </MenuContent>
                </Menu>
              )}
              {!panel && <button className="btn btn-primary h-9 text-[13px]" onClick={() => togglePanel(true)}><ChatCircleText size={16} />Mentor</button>}
            </div>
          </div>
          {b?.tagline && <p className="ml-9 mt-0.5 text-[13px] text-ink-500">{b.tagline}</p>}
          {previewing && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[8px] border border-[#F1D58A] bg-[#FFF8E1] px-3 py-2 text-[13px] text-[#6B4E00]">
              Previewing v{previewing.version} (view only).
              <button className="font-semibold underline" onClick={() => restore(previewing)}>Restore this version</button>
              <button className="font-semibold underline" onClick={() => router.replace(`/builds/${id}?tab=${tab}`)}>Back to current</button>
            </div>
          )}
          <nav className="scroll-thin mt-3 flex gap-1 overflow-x-auto" role="tablist" aria-label="Build sections">
            {TABS.map(({ key, label, Icon }) => (
              <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`flex shrink-0 items-center gap-1.5 border-b-[3px] px-3 pb-2.5 pt-1.5 text-[13.5px] font-semibold ${tab === key ? 'border-fdr-red text-fdr-red' : 'border-transparent text-ink-600 hover:text-ink-900'}`}>
                <Icon size={16} />{label}
                {key === 'rules' && d && d.ruleChecks.some((c) => c.severity === 'error' && !c.pass) && <span className="ml-0.5 rounded-full bg-fdr-red px-1.5 text-[10.5px] text-white">{d.ruleChecks.filter((c) => c.severity === 'error' && !c.pass).length}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 sm:p-6">
          {!d ? (derived.isError ? <div className="card rounded-[10px] p-8 text-center text-[14px] text-ink-500">{(derived.error as Error).message}</div> : <Skeleton className="h-[560px] rounded-[10px]" />) : (
            <TabBody tab={tab} d={d} id={id} askMentor={askMentor} readOnly={!!previewing} />
          )}
        </div>
      </div>
      {panel && (
        <aside className="sticky top-[62px] hidden h-[calc(100vh-62px)] w-[400px] shrink-0 flex-col border-l border-line bg-white lg:flex" aria-label="AI Build Mentor">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <img src={`${BASE}/brand/mentor-b.png`} alt="" className="h-8 w-8" />
            <div className="min-w-0 flex-1"><div className="text-[14px] font-bold text-ink-900">AI Build Mentor</div><div className="truncate text-[11.5px] text-ink-500">Designing: {b?.name} v{cur?.version}</div></div>
            <button aria-label="New conversation" onClick={() => { setThread(null); setInitial(null); setMentorKey((k) => k + 1); }} className="rounded-md px-2 py-1 text-[12px] font-semibold text-ink-600 hover:bg-black/5">New</button>
            <button aria-label="Collapse mentor panel" onClick={() => togglePanel(false)} className="rounded-md p-1.5 text-ink-500 hover:bg-black/5 hover:text-ink-900"><X size={17} /></button>
          </div>
          <div className="min-h-0 flex-1"><MentorChat key={mentorKey} threadId={thread} onThread={setThread} buildId={id} initial={initial} /></div>
        </aside>
      )}
    </div>
  );
}

function TabBody({ tab, d, id, askMentor, readOnly }: { tab: TabKey; d: Derived; id: string; askMentor: (t: string) => void; readOnly: boolean }) {
  switch (tab) {
    case 'model': return <ModelTab d={d} />;
    case 'blueprint': return <BlueprintTab d={d} />;
    case 'assembly': return <AssemblyTab d={d} />;
    case 'code': return <div className="card h-[calc(100vh-230px)] min-h-[560px] overflow-hidden rounded-[10px]"><CodeIDE buildId={id} embedded /></div>;
    case 'specs': return <SpecsTab d={d} buildId={id} />;
    case 'parts': return <PartsTab buildId={id} readOnly={readOnly} />;
    case 'rules': return <RulesTab d={d} askMentor={askMentor} />;
  }
}

