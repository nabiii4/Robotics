'use client';
import { useEffect, useState } from 'react';
import { BASE, LOCAL } from '@/lib/client/base';
import { Loading } from './shell/LocalAppShell';

/**
 * GitHub Pages build: the API runs in a service worker (browser-server/sw.ts). Wait until it controls this page
 * before rendering anything that fetches data.
 */
export function LocalGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!LOCAL);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!LOCAL) return;
    const sw = navigator.serviceWorker;
    if (!sw) { setError('This browser can’t run the Hub offline engine. Use a current Chrome, Edge, Safari or Firefox in a normal (not private) window.'); return; }
    const done = () => setReady(true);
    sw.addEventListener('controllerchange', done);
    sw.register(`${BASE}/sw.js`, { scope: `${BASE}/` })
      .then(async (reg) => {
        if (sw.controller) return done();
        // after a hard refresh the worker is active but not in charge of this page yet
        const active = reg.active ?? (await sw.ready).active;
        active?.postMessage('claim');
      })
      .catch((e: Error) => setError(`The Hub couldn’t start in this browser: ${e.message}`));
    return () => sw.removeEventListener('controllerchange', done);
  }, []);
  if (error) return <div className="flex min-h-screen items-center justify-center bg-page-b px-6 text-center text-[14px] text-ink-700">{error}</div>;
  if (!ready) return <Loading label="Starting the Hub…" />;
  return <>{children}</>;
}
