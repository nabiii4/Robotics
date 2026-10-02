'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, ClientError } from '@/lib/client/api';
import { BASE, LOCAL, LOCAL_COACH, SIGNED_OUT_KEY } from '@/lib/client/base';
import { Spinner } from '@/components/ui/bits';

export function LoginForm({ next }: { next?: string }) {
  const [username, setU] = useState(LOCAL ? LOCAL_COACH.username : '');
  const [password, setP] = useState(LOCAL ? LOCAL_COACH.password : '');
  const [keep, setKeep] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ mustChangePassword: boolean }>('/api/auth/login', { username, password, keep });
      if (LOCAL) localStorage.removeItem(SIGNED_OUT_KEY);
      // the static GitHub Pages build can't read ?next= on the server, so fall back to the address bar
      const to = next ?? new URLSearchParams(location.search).get('next');
      location.href = r.mustChangePassword ? `${BASE}/settings/security?first=1` : to && to.startsWith('/') && !to.startsWith('//') ? to : `${BASE}/`;
    } catch (e2) {
      setErr((e2 as ClientError).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card rounded-[12px] p-6">
      <h2 className="text-[22px] font-bold text-ink-900">Sign in</h2>
      <p className="mb-5 mt-1 text-[13.5px] text-ink-500">Welcome back, Cougar.</p>
      {LOCAL && (
        <p className="mb-4 rounded-md bg-[#F3F5F7] px-3 py-2 text-[12.5px] text-ink-600">
          This version runs entirely in your browser, and everything you do is saved on this device. The coach account is filled in for you (password <span className="font-mono">{LOCAL_COACH.password}</span>).
        </p>
      )}
      <label className="label" htmlFor="u">Username</label>
      <input id="u" className="input mb-3" autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} required autoFocus />
      <label className="label" htmlFor="p">Password</label>
      <input id="p" type="password" className="input mb-3" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} required />
      <label className="mb-4 flex items-center gap-2 text-[13px] text-ink-700"><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-4 w-4 accent-[#C8061C]" /> Keep me signed in</label>
      {err && <div role="alert" className="mb-3 rounded-md border border-fdr-red-100 bg-fdr-red-tint px-3 py-2 text-[13px] text-fdr-red">{err}</div>}
      <button className="btn btn-primary h-11 w-full text-[15px]" disabled={busy}>{busy ? <Spinner /> : 'Sign in'}</button>
      <div className="mt-4 flex items-center justify-between text-[13px]">
        <Link href="/join" className="font-semibold text-fdr-red hover:underline">Join the team</Link>
        <button type="button" onClick={() => setForgot((f) => !f)} className="text-ink-500 hover:text-ink-900">Forgot password?</button>
      </div>
      {forgot && <p className="mt-3 rounded-md bg-[#F3F5F7] px-3 py-2 text-[12.5px] text-ink-600">Ask your coach to reset your password — admins can do it under Settings → Team.</p>}
    </form>
  );
}
