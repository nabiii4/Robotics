'use client';
import { Suspense, useEffect, useState } from 'react';
import { api, ClientError } from '@/lib/client/api';
import { BASE, LOCAL_COACH, SIGNED_OUT_KEY } from '@/lib/client/base';
import { toast } from '../ui/Toast';
import { Spinner } from '../ui/bits';
import { AppShell, type Me } from './AppShell';

const WELCOMED_KEY = 'hub-local-welcomed';
// no keys can ship in a static site, so the browser version always runs the built-in mentor
const AI_MODE = { configured: false, demo: true, targets: [] };

export function Loading({ label }: { label: string }) {
  return <div className="flex min-h-screen items-center justify-center gap-3 bg-page-b text-[14px] text-ink-600"><Spinner size={20} />{label}</div>;
}

/** App shell for the GitHub Pages build: finds (or signs in) the user from the in-browser server instead of a server session. */
export function LocalAppShell({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetchMe();
        if (alive) setMe(r);
      } catch (e) {
        if (!(e instanceof ClientError) || e.status !== 401) toast.error('Couldn’t open the Hub', (e as Error).message);
      }
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!me || localStorage.getItem(WELCOMED_KEY)) return;
    localStorage.setItem(WELCOMED_KEY, '1');
    toast.info('Welcome to the FDRHS Robotics Hub', 'This version runs in your browser. Your work is saved on this device; use Settings → Data to export it or move it to another computer.');
  }, [me]);
  if (!me) return <Loading label="Opening the Hub…" />;
  return <AppShell me={me} aiMode={AI_MODE}><Suspense fallback={<Loading label="Loading…" />}>{children}</Suspense></AppShell>;
}

async function fetchMe(): Promise<Me> {
  const get = () => fetch(`${BASE}/api/me`, { cache: 'no-store' });
  let r = await get();
  if (r.status === 401) {
    // first visit: sign in as the coach automatically (unless the user signed out on purpose)
    if (localStorage.getItem(SIGNED_OUT_KEY)) {
      location.href = `${BASE}/login?next=${encodeURIComponent(location.pathname)}`;
      throw new ClientError(401, 'Please sign in.');
    }
    await api.post('/api/auth/login', { ...LOCAL_COACH, keep: true });
    r = await get();
  }
  if (!r.ok) throw new ClientError(r.status, `The Hub couldn’t start (${r.status}).`);
  return ((await r.json()) as { user: Me }).user;
}
