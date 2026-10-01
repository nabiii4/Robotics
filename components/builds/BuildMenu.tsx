'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DotsThree } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { useMe } from '@/components/shell/AppShell';
import type { BuildListItem } from '@/components/mentor/MentorDrawer';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuSub, MenuSubContent, MenuSubTrigger, MenuTrigger } from '@/components/ui/Menu';
import { Dialog } from '@/components/ui/Dialog';
import { toast } from '@/components/ui/Toast';

export const PROGRAM: Record<string, string> = { V5RC: 'V5RC', VEXU: 'VEX U', VAIRC: 'VEX AI', Practice: 'Practice' };
export const STATUS_TONE: Record<string, 'red' | 'green' | 'grey' | 'blue' | 'amber'> = { planned: 'grey', in_progress: 'red', testing: 'amber', ready: 'green', archived: 'grey' };

export function BuildMenu({ b, onRenamed, trigger }: { b: BuildListItem; onRenamed?: () => void; trigger?: React.ReactNode }) {
  const { me } = useMe();
  const qc = useQueryClient();
  const router = useRouter();
  const [rename, setRename] = useState(false);
  const [name, setName] = useState(b.name);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['builds'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['derived'] }); };
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); refresh(); toast.ok(ok); } catch (e) { toast.error('That didn’t work', (e as ClientError).message); } };
  const canCaptain = me.role !== 'member';
  return (
    <>
      <Menu>
        <MenuTrigger asChild>{trigger ?? <button aria-label={`${b.name} menu`} className="rounded-md p-1 text-ink-500 hover:bg-black/5 hover:text-ink-900"><DotsThree size={20} weight="bold" /></button>}</MenuTrigger>
        <MenuContent width={220}>
          <MenuItem onSelect={() => router.push(`/builds/${b.id}`)}>Open</MenuItem>
          {canCaptain && !b.isTeamActive && <MenuItem onSelect={() => act(() => api.post(`/api/builds/${b.id}/activate`), `${b.name} is now the Active Build`)}>Set as Active Build</MenuItem>}
          <MenuItem onSelect={() => act(async () => { const r = await api.post<{ id: string }>(`/api/builds/${b.id}/duplicate`); router.push(`/builds/${r.id}`); }, 'Duplicated')}>Duplicate</MenuItem>
          <MenuItem onSelect={() => { setName(b.name); setRename(true); }}>Rename</MenuItem>
          <MenuSub>
            <MenuSubTrigger>Export</MenuSubTrigger>
            <MenuSubContent>
              <MenuItem onSelect={() => download(`/api/builds/${b.id}/spec.json`)}>RobotSpec (JSON)</MenuItem>
              <MenuItem onSelect={() => download(`/api/builds/${b.id}/bom.csv`)}>BOM (CSV)</MenuItem>
              <MenuItem onSelect={() => router.push(`/builds/${b.id}?tab=blueprint&export=pdf`)}>Blueprint (PDF)</MenuItem>
              <MenuItem onSelect={() => download(`/api/builds/${b.id}/parts/stl.zip`)}>Printed parts (STL zip)</MenuItem>
              <MenuItem onSelect={() => download(`/api/builds/${b.id}/code/zip`)}>Code (zip)</MenuItem>
            </MenuSubContent>
          </MenuSub>
          <MenuSeparator />
          {b.status !== 'archived'
            ? <MenuItem onSelect={() => act(() => api.patch(`/api/builds/${b.id}`, { status: 'archived' }), 'Archived')}>Archive</MenuItem>
            : <MenuItem onSelect={() => act(() => api.patch(`/api/builds/${b.id}`, { status: 'in_progress' }), 'Unarchived')}>Unarchive</MenuItem>}
          {(b.ownerId === me.id || me.role === 'admin') && <MenuItem danger onSelect={() => { if (confirm(`Delete ${b.name}? You can restore it for 30 days.`)) act(async () => { await api.del(`/api/builds/${b.id}`); router.push('/builds'); }, 'Deleted — restore it from Recently deleted'); }}>Delete</MenuItem>}
        </MenuContent>
      </Menu>
      <Dialog open={rename} onOpenChange={setRename} title="Rename build" width={420}
        footer={<><button className="btn btn-outline" onClick={() => setRename(false)}>Cancel</button><button className="btn btn-primary" disabled={!name.trim()} onClick={() => act(async () => { await api.patch(`/api/builds/${b.id}`, { name: name.trim() }); setRename(false); onRenamed?.(); }, 'Renamed')}>Save</button></>}>
        <input autoFocus className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) (e.currentTarget.closest('[role=dialog]')?.querySelector('.btn-primary') as HTMLButtonElement)?.click(); }} />
      </Dialog>
    </>
  );
}

