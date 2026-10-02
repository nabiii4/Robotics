'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { DownloadSimple, Trash } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { strength } from '@/lib/strength';
import { useMe } from '../shell/AppShell';
import { Avatar, Field, Segmented } from '../ui/bits';
import { Switch } from '../ui/Switch';
import { toast } from '../ui/Toast';
import { MemoryPanel } from '../mentor/MemoryPanel';

const COLORS = ['#1B67C6', '#C11A0E', '#1C9E4B', '#643DBC', '#EA8111', '#0E7490', '#C2185B', '#171D22', '#B4101C'];
const TEAM_ROLES = ['Builder', 'Programmer', 'Driver', 'Designer', 'Notebook', 'Captain', 'Coach'];

export function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4 rounded-[10px] p-5">
      <h2 className="text-[16px] font-bold text-ink-900">{title}</h2>
      {desc && <p className="mb-4 mt-0.5 text-[13px] text-ink-500">{desc}</p>}
      <div className={desc ? '' : 'mt-4'}>{children}</div>
    </section>
  );
}

export function ProfileTab() {
  const { me, setMe } = useMe();
  const [f, setF] = useState({ displayName: me.displayName, avatarColor: me.avatarColor, teamRole: me.teamRole, grade: me.grade ?? '', bio: me.bio ?? '', skills: me.skills.join(', ') });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const r = await api.patch<{ user: typeof me }>('/api/me', { displayName: f.displayName.trim(), avatarColor: f.avatarColor, teamRole: f.teamRole, grade: f.grade || null, bio: f.bio || null, skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10) });
      setMe(r.user); toast.ok('Profile saved');
    } catch (e) { toast.error('Could not save', (e as ClientError).message); } finally { setSaving(false); }
  };
  return (
    <Section title="Profile" desc="How you show up to the team.">
      <div className="grid max-w-[560px] gap-4">
        <div className="flex items-center gap-4"><Avatar user={{ ...me, displayName: f.displayName, avatarColor: f.avatarColor }} size={56} /><div className="flex flex-wrap gap-2">{COLORS.map((c) => <button key={c} aria-label={`Avatar color ${c}`} aria-pressed={f.avatarColor === c} onClick={() => setF({ ...f, avatarColor: c })} className={`h-8 w-8 rounded-full border-2 ${f.avatarColor === c ? 'border-ink-900' : 'border-white ring-1 ring-line'}`} style={{ background: c }} />)}</div></div>
        <Field label="Display name"><input className="input" maxLength={40} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team role"><select className="input" value={f.teamRole} onChange={(e) => setF({ ...f, teamRole: e.target.value })}>{TEAM_ROLES.map((r) => <option key={r}>{r}</option>)}</select></Field>
          <Field label="Grade (optional)"><select className="input" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })}><option value="">—</option>{['9', '10', '11', '12'].map((g) => <option key={g}>{g}</option>)}</select></Field>
        </div>
        <Field label="Skills" hint="Comma-separated, e.g. CAD, C++, driving"><input className="input" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} /></Field>
        <Field label="Short bio"><textarea className="input min-h-[80px]" maxLength={300} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <button className="btn btn-primary h-10 w-fit px-5" disabled={saving || !f.displayName.trim()} onClick={save}>Save profile</button>
      </div>
    </Section>
  );
}

export function AppearanceTab() {
  const { me, savePrefs } = useMe();
  const save = (p: Parameters<typeof savePrefs>[0]) => savePrefs(p).then(() => toast.ok('Saved')).catch((e) => toast.error('Could not save', (e as ClientError).message));
  return (
    <Section title="Appearance" desc="Choose your dashboard layout and how the 3D viewer runs on this computer.">
      <div className="grid max-w-[640px] gap-6">
        <div>
          <div className="label mb-2">Dashboard layout</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {([['b', 'Hub (B)', 'Top tabs, big hero — the default'], ['a', 'Sidebar (A)', 'Left sidebar with every section'], ['auto', 'Auto', 'Sidebar on screens ≥ 1600 px, otherwise Hub']] as const).map(([v, l, t]) => (
              <button key={v} aria-pressed={(me.prefs.layout ?? 'b') === v} onClick={() => save({ layout: v })} className={`rounded-[8px] border p-3 text-left ${(me.prefs.layout ?? 'b') === v ? 'border-fdr-red bg-[#FFF5F5]' : 'border-line hover:border-ink-300'}`}>
                <div className={`mb-2 h-14 rounded-md border border-line bg-[#F2F4F3] p-1.5 ${v === 'a' ? 'flex gap-1' : ''}`}>
                  {v === 'a' ? <><div className="w-4 rounded bg-ink-800" /><div className="flex-1 rounded bg-white" /></> : v === 'b' ? <><div className="mb-1 h-2 rounded bg-white" /><div className="h-8 rounded bg-white" /></> : <div className="flex h-full items-center justify-center text-[11px] text-ink-500">A ⇄ B</div>}
                </div>
                <div className="text-[13.5px] font-semibold text-ink-900">{l}</div><div className="text-[11.5px] text-ink-500">{t}</div>
              </button>
            ))}
          </div>
        </div>
        <div><div className="label mb-2">3D quality</div><Segmented value={me.prefs.quality ?? 'medium'} onChange={(v) => save({ quality: v })} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} /><p className="mt-1 text-[12px] text-ink-500">Use Low on Chromebooks or older laptops.</p></div>
        <label className="flex items-center justify-between rounded-[8px] border border-line px-4 py-3"><span><span className="block text-[14px] font-semibold text-ink-900">Reduce motion</span><span className="text-[12px] text-ink-500">Turn off camera tweens and animations</span></span><Switch checked={!!me.prefs.reduceMotion} onCheckedChange={(v) => save({ reduceMotion: v })} label="Reduce motion" /></label>
      </div>
    </Section>
  );
}

export function AiMemoryTab() {
  const { me, savePrefs } = useMe();
  const qc = useQueryClient();
  const save = (p: Parameters<typeof savePrefs>[0]) => savePrefs(p).then(() => toast.ok('Saved')).catch((e) => toast.error('Could not save', (e as ClientError).message));
  const wipe = async (what: 'memories' | 'chats') => {
    if (!confirm(what === 'memories' ? 'Delete everything the mentor remembers about you?' : 'Delete all your mentor conversations?')) return;
    try { await api.del(what === 'memories' ? '/api/ai/memories' : '/api/me/chats'); qc.invalidateQueries({ queryKey: [what === 'memories' ? 'memories' : 'threads'] }); toast.ok(what === 'memories' ? 'All memories deleted' : 'All chats cleared'); }
    catch (e) { toast.error('Could not delete', (e as ClientError).message); }
  };
  return (
    <>
      <Section title="AI Mentor" desc="How the mentor talks to you.">
        <div className="grid max-w-[640px] gap-4">
          <div><div className="label mb-2">Reply length</div><Segmented value={me.prefs.replyLength ?? 'concise'} onChange={(v) => save({ replyLength: v })} options={[{ value: 'concise', label: 'Concise' }, { value: 'detailed', label: 'Detailed' }]} /></div>
          <label className="flex items-center justify-between rounded-[8px] border border-line px-4 py-3"><span><span className="block text-[14px] font-semibold text-ink-900">Memory</span><span className="text-[12px] text-ink-500">Let the mentor remember useful things about you between chats</span></span><Switch checked={me.prefs.memoryEnabled !== false} onCheckedChange={(v) => save({ memoryEnabled: v })} label="Memory" /></label>
        </div>
      </Section>
      <Section title="What the mentor remembers" desc="Only you (and nobody else on the team) can see these notes.">
        <div className="max-w-[640px]"><MemoryPanel disabled={me.prefs.memoryEnabled === false} /></div>
      </Section>
      <Section title="Your data">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-outline h-9" onClick={() => download('/api/me/export')}><DownloadSimple size={16} />Download my data (JSON)</button>
          <button className="btn btn-outline h-9 text-fdr-red" onClick={() => wipe('chats')}><Trash size={16} />Clear all chats</button>
          <button className="btn btn-outline h-9 text-fdr-red" onClick={() => wipe('memories')}><Trash size={16} />Delete all memories</button>
        </div>
      </Section>
    </>
  );
}

const NOTIF: [string, string, string][] = [
  ['print', 'Prints', 'When your print finishes or fails'], ['task', 'Tasks', 'When someone assigns you a task'], ['inventory', 'Low stock', 'When a part runs low (captains & admins)'],
  ['order', 'Orders', 'When parts you asked for arrive, or requests come in'], ['team', 'Team', 'When someone joins the team (admins)'],
];
export function NotificationsTab() {
  const { me, savePrefs } = useMe();
  const qc = useQueryClient();
  const set = (k: string, v: boolean) => savePrefs({ notif: { ...(me.prefs.notif ?? {}), [k]: v } }).then(() => qc.invalidateQueries({ queryKey: ['notifications'] })).catch((e) => toast.error('Could not save', (e as ClientError).message));
  return (
    <Section title="Notifications" desc="Choose what shows up in the bell.">
      <div className="grid max-w-[560px] divide-y divide-line rounded-[8px] border border-line">
        {NOTIF.map(([k, l, d]) => <label key={k} className="flex items-center justify-between px-4 py-3"><span><span className="block text-[14px] font-semibold text-ink-900">{l}</span><span className="text-[12px] text-ink-500">{d}</span></span><Switch checked={me.prefs.notif?.[k] !== false} onCheckedChange={(v) => set(k, v)} label={l} /></label>)}
      </div>
    </Section>
  );
}

export function SecurityTab() {
  const { me, setMe } = useMe();
  const sp = useSearchParams();
  const router = useRouter();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState<string | null>(null);
  const first = sp.get('first') === '1' || me.mustChangePassword;
  const s = strength(f.next);
  useEffect(() => setErr(null), [f]);
  const change = async () => {
    if (f.next !== f.confirm) { setErr('The new passwords don’t match.'); return; }
    try { await api.post('/api/me/password', { current: f.current, next: f.next }); setMe({ ...me, mustChangePassword: false }); setF({ current: '', next: '', confirm: '' }); toast.ok('Password changed'); if (first) router.push('/'); }
    catch (e) { setErr((e as ClientError).message); }
  };
  const revoke = async () => { try { await api.post('/api/me/sessions/revoke-others'); toast.ok('Signed out on every other device'); } catch (e) { toast.error('Could not sign out others', (e as ClientError).message); } };
  return (
    <>
      <Section title="Change password" desc={first ? 'Choose a new password before you continue — the one you were given is temporary.' : 'At least 10 characters. A short phrase works well.'}>
        <form className="grid max-w-[420px] gap-3" onSubmit={(e) => { e.preventDefault(); change(); }}>
          <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
          <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
          <div className="flex gap-1" aria-label={`Strength ${s} of 4`}>{[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded ${i < s ? (s < 2 ? 'bg-fdr-red' : s < 3 ? 'bg-warn' : 'bg-ok') : 'bg-track'}`} />)}</div>
          <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
          {err && <p className="text-[13px] text-fdr-red">{err}</p>}
          <button className="btn btn-primary h-10 w-fit px-5" disabled={!f.current || f.next.length < 10}>Change password</button>
        </form>
      </Section>
      <Section title="Sessions" desc="Signed in on a school computer and forgot to sign out?">
        <button className="btn btn-outline h-9" onClick={revoke}>Sign out all other sessions</button>
      </Section>
    </>
  );
}
