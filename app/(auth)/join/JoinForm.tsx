'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, ClientError } from '@/lib/client/api';
import { strength } from '@/lib/strength';
import { Spinner } from '@/components/ui/bits';

const ROLES = ['Builder', 'Programmer', 'Driver', 'Designer', 'Notebook', 'Captain'];
export function JoinForm() {
  const [f, setF] = useState({ code: '', displayName: '', username: '', password: '', teamRole: 'Builder', grade: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = strength(f.password);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await api.post('/api/auth/join', { ...f, grade: f.grade || null }); location.href = '/'; }
    catch (e2) { setErr((e2 as ClientError).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card rounded-[12px] p-6">
      <h2 className="text-[22px] font-bold text-ink-900">Join the team</h2>
      <p className="mb-5 mt-1 text-[13.5px] text-ink-500">Get the join code from your coach. No email needed.</p>
      <div className="grid gap-3">
        <div><label className="label" htmlFor="c">Join code</label><input id="c" className="input uppercase" value={f.code} onChange={set('code')} required placeholder="COUGAR-XXXXXX" /></div>
        <div><label className="label" htmlFor="d">Display name</label><input id="d" className="input" value={f.displayName} onChange={set('displayName')} required maxLength={40} placeholder="First name" /></div>
        <div><label className="label" htmlFor="un">Username</label><input id="un" className="input" autoComplete="username" value={f.username} onChange={set('username')} required minLength={3} /></div>
        <div>
          <label className="label" htmlFor="pw">Password (10+ characters)</label>
          <input id="pw" type="password" className="input" autoComplete="new-password" value={f.password} onChange={set('password')} required minLength={10} />
          <div className="mt-1.5 flex gap-1" aria-label={`Password strength ${s} of 4`}>{[0, 1, 2, 3].map((i) => <span key={i} className="h-1 flex-1 rounded" style={{ background: i < s ? ['#C8061C', '#EA8111', '#FCC100', '#1FA84F'][s - 1] : '#E0E3E7' }} />)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="r">Team role</label><select id="r" className="input" value={f.teamRole} onChange={set('teamRole')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
          <div><label className="label" htmlFor="g">Grade (optional)</label><input id="g" className="input" value={f.grade} onChange={set('grade')} maxLength={10} /></div>
        </div>
      </div>
      {err && <div role="alert" className="mt-3 rounded-md border border-fdr-red-100 bg-fdr-red-tint px-3 py-2 text-[13px] text-fdr-red">{err}</div>}
      <button className="btn btn-primary mt-4 h-11 w-full text-[15px]" disabled={busy}>{busy ? <Spinner /> : 'Create my account'}</button>
      <p className="mt-4 text-center text-[13px] text-ink-500">Already on the team? <Link href="/login" className="font-semibold text-fdr-red hover:underline">Sign in</Link></p>
    </form>
  );
}
