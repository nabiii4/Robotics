'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CaretDown, SignOut, UserCircle, GearSix, Layout, Trophy, BookOpen, Terminal, Info, PlugsConnected } from '@phosphor-icons/react';
import { api } from '@/lib/client/api';
import { useBrain } from '@/lib/client/stores';
import { timeAgo } from '@/lib/format';
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator, MenuLabel } from '../ui/Menu';
import { Avatar } from '../ui/bits';
import { Tip } from '../ui/Tip';
import { toast } from '../ui/Toast';
import { useMe } from './AppShell';
import * as Popover from '@radix-ui/react-popover';
import { BASE, LOCAL, SIGNED_OUT_KEY } from '@/lib/client/base';

interface Presence { online: boolean; who: string | null }

export function usePresence() {
  return useQuery({ queryKey: ['presence'], queryFn: () => api.get<Presence>('/api/brain/presence'), refetchInterval: 15_000, refetchIntervalInBackground: false });
}

/** VEX Brain status pill (spec §6.7) */
export function BrainPill({ variant }: { variant: 'a' | 'b' }) {
  const { status, connect, disconnect, setConsole, portLabel } = useBrain();
  const pres = usePresence();
  const dot = <span className="block h-2 w-2 rounded-full bg-ok" />;
  const base = 'flex h-[30px] items-center gap-2 whitespace-nowrap rounded-full px-3 text-[12.5px] font-semibold transition-colors';
  const doConnect = async () => {
    try { await connect(); } catch (e) { toast.error('Could not connect to the Brain', (e as Error).message); }
  };
  if (status === 'connected') {
    return (
      <Menu>
        <MenuTrigger asChild>
          <button className={`${base} bg-ok-50 text-ok-ink ${variant === 'b' ? 'justify-between border border-ok-200' : ''}`} style={{ width: variant === 'b' ? 167 : 164 }} aria-label="VEX Brain connected — open Brain menu">
            {dot}VEX Brain Connected{variant === 'b' && dot}
          </button>
        </MenuTrigger>
        <MenuContent width={230}>
          <MenuLabel>{portLabel ?? 'VEX V5 Brain'}</MenuLabel>
          <MenuItem onSelect={() => setConsole(true)}><Terminal size={16} />Open Console</MenuItem>
          <MenuItem onSelect={() => toast.info('Brain info', `${portLabel ?? 'VEX V5'} · User port · 115200 baud`)}><Info size={16} />Brain info</MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => disconnect()}><PlugsConnected size={16} />Disconnect</MenuItem>
        </MenuContent>
      </Menu>
    );
  }
  if (status === 'unsupported') {
    return <Tip label={pres.data?.online ? `Connected on ${pres.data.who}'s laptop` : 'Web Serial works in Chrome or Edge on a computer'}><span className={`${base} bg-[#EEF0F2] text-ink-600`} style={{ width: 164 }}>VEX Brain (use Chrome/Edge)</span></Tip>;
  }
  if (pres.data?.online) {
    return (
      <Tip label={`Connected on ${pres.data.who}'s laptop`}>
        <button onClick={doConnect} className={`${base} bg-[#EEF0F2] text-ink-600 hover:bg-[#E3E6E9]`} style={{ width: 196 }} aria-label="Connect VEX Brain here">
          VEX Brain Not Connected <span className="rounded bg-white px-1.5 py-0.5 text-[11px] text-fdr-red">Connect</span>
        </button>
      </Tip>
    );
  }
  return (
    <button onClick={doConnect} disabled={status === 'connecting'} className={`${base} bg-[#EEF0F2] text-ink-700 hover:bg-[#E3E6E9]`} style={{ width: variant === 'b' ? 167 : 164, justifyContent: 'center' }}>
      {status === 'connecting' ? 'Connecting…' : 'Connect VEX Brain'}
    </button>
  );
}

interface Notif { id: string; title: string; body: string | null; link: string | null; readAt: number | null; createdAt: number }

export function NotificationBell({ variant }: { variant: 'a' | 'b' }) {
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<{ items: Notif[]; unread: number }>('/api/notifications'), refetchInterval: 30_000 });
  const unread = q.data?.unread ?? 0;
  const markAll = async () => { await api.post('/api/notifications/read', { all: true }); qc.invalidateQueries({ queryKey: ['notifications'] }); };
  const open = async (n: Notif) => {
    if (!n.readAt) { await api.post('/api/notifications/read', { ids: [n.id] }); qc.invalidateQueries({ queryKey: ['notifications'] }); }
    if (n.link) router.push(n.link);
  };
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative flex h-[30px] w-[30px] items-center justify-center rounded-md text-ink-900 hover:bg-black/5">
          <Bell size={22} />
          {unread > 0 && <span className={`absolute right-[5px] top-[2px] block rounded-full bg-fdr-red ${variant === 'b' ? 'h-2 w-2 shadow-[0_0_0_2px_#fff]' : 'h-[7px] w-[7px]'}`} />}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} className="z-[70] w-[360px] max-w-[calc(100vw-24px)] rounded-[12px] border border-line bg-white shadow-[0_12px_32px_rgb(16_24_40/.16)]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[14px] font-bold">Notifications</span>
            <button onClick={markAll} disabled={!unread} className="text-[12.5px] font-semibold text-fdr-red disabled:opacity-40">Mark all read</button>
          </div>
          <div className="scroll-thin max-h-[380px] overflow-y-auto">
            {(q.data?.items ?? []).length === 0 && <p className="px-4 py-8 text-center text-[13px] text-ink-500">You’re all caught up.</p>}
            {(q.data?.items ?? []).map((n) => (
              <Popover.Close asChild key={n.id}>
                <button onClick={() => open(n)} className="flex w-full items-start gap-2.5 border-b border-[#F1F2F4] px-4 py-3 text-left last:border-0 hover:bg-[#F8F9FA]">
                  <span className={`mt-1.5 block h-2 w-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-fdr-red'}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] ${n.readAt ? 'text-ink-700' : 'font-semibold text-ink-900'}`}>{n.title}</span>
                    {n.body && <span className="block text-[12px] text-ink-500">{n.body}</span>}
                    <span className="block text-[11.5px] text-ink-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </Popover.Close>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function AvatarMenu({ variant }: { variant: 'a' | 'b' }) {
  const { me, layout, savePrefs } = useMe();
  const router = useRouter();
  const signOut = async () => {
    await api.post('/api/auth/logout');
    if (LOCAL) localStorage.setItem(SIGNED_OUT_KEY, '1'); // don't sign straight back in
    location.href = `${BASE}/login`;
  };
  return (
    <Menu>
      <MenuTrigger asChild>
        {variant === 'b' ? (
          <button className="flex items-center gap-[30px] rounded-full" aria-label="Account menu">
            <Avatar user={{ ...me, avatarColor: '#171D22' }} size={40} />
            <CaretDown size={14} weight="bold" className="text-ink-900" />
          </button>
        ) : (
          <button aria-label="Account menu" className="rounded-full"><Avatar user={{ ...me, avatarColor: '#B4101C' }} size={38} /></button>
        )}
      </MenuTrigger>
      <MenuContent width={240}>
        <div className="px-2.5 py-2">
          <div className="text-[13.5px] font-semibold text-ink-900">{me.displayName}</div>
          <div className="text-[12px] text-ink-500">{me.teamRole} · {me.role}</div>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => router.push('/settings/profile')}><UserCircle size={16} />Profile</MenuItem>
        <MenuItem onSelect={() => router.push('/settings')}><GearSix size={16} />Settings</MenuItem>
        <MenuItem onSelect={() => savePrefs({ layout: layout === 'a' ? 'b' : 'a' })}><Layout size={16} />Switch to {layout === 'a' ? 'Hub' : 'Sidebar'} layout</MenuItem>
        {variant === 'b' && (
          <>
            <MenuSeparator />
            <MenuItem onSelect={() => router.push('/competitions')}><Trophy size={16} />Competitions</MenuItem>
            <MenuItem onSelect={() => router.push('/resources')}><BookOpen size={16} />Resources</MenuItem>
          </>
        )}
        <MenuSeparator />
        <MenuItem onSelect={signOut}><SignOut size={16} />Sign out</MenuItem>
      </MenuContent>
    </Menu>
  );
}

export const NAV = [
  { href: '/', label: 'Dashboard', short: 'Home' },
  { href: '/builds', label: 'Builds', short: 'Builds' },
  { href: '/printer', label: '3D Printer', short: 'Printer' },
  { href: '/parts', label: 'Parts', long: 'Parts & Inventory', short: 'Parts' },
  { href: '/code', label: 'VEX Code', short: 'Code' },
  { href: '/team', label: 'Team', short: 'Team' },
] as const;

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({ href, className, children, onClick }: { href: string; className?: string; children: React.ReactNode; onClick?: () => void }) {
  return <Link href={href} className={className} onClick={onClick}>{children}</Link>;
}
