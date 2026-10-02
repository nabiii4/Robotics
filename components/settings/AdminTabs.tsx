'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowsClockwise, CheckCircle, DownloadSimple, Eye, EyeSlash, FileArrowUp, Plus, Trash, Warning, XCircle } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { timeAgo } from '@/lib/format';
import { Badge, Field, Spinner } from '../ui/bits';
import { Dialog } from '../ui/Dialog';
import { Switch } from '../ui/Switch';
import { toast } from '../ui/Toast';
import { Section } from './PersonalTabs';
import { usePrinters, MATERIALS, type PrinterView } from '../printer/SendToPrinterDialog';
import { BASE, LOCAL, SIGNED_OUT_KEY } from '@/lib/client/base';

export function TeamAdminTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-team'], queryFn: () => api.get<{ team: { name: string; school: string; teamNumber: string | null } | null; joinCode: string | null }>('/api/admin/team') });
  const [f, setF] = useState({ name: '', school: '', teamNumber: '' });
  const [show, setShow] = useState(false);
  useEffect(() => { if (q.data?.team) setF({ name: q.data.team.name, school: q.data.team.school, teamNumber: q.data.team.teamNumber ?? '' }); }, [q.data]);
  const save = async () => { try { await api.patch('/api/admin/team', { ...f, teamNumber: f.teamNumber || null }); qc.invalidateQueries({ queryKey: ['admin-team'] }); toast.ok('Saved'); } catch (e) { toast.error('Could not save', (e as ClientError).message); } };
  const rotate = async () => { if (!confirm('Make a new join code? The old one stops working right away.')) return; try { await api.post('/api/admin/join-code'); qc.invalidateQueries({ queryKey: ['admin-team'] }); setShow(true); toast.ok('New join code ready'); } catch (e) { toast.error('Could not rotate', (e as ClientError).message); } };
  return (
    <>
      <Section title="Team" desc="Shown on blueprints and exports.">
        <div className="grid max-w-[560px] gap-3">
          <Field label="Team name"><input className="input" maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="School"><input className="input" maxLength={120} value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} /></Field>
          <Field label="Team number"><input className="input" maxLength={12} value={f.teamNumber} onChange={(e) => setF({ ...f, teamNumber: e.target.value })} placeholder="e.g. 12345A" /></Field>
          <button className="btn btn-primary h-10 w-fit px-5" onClick={save}>Save</button>
        </div>
      </Section>
      <Section title="Join code" desc="New members sign up at /join with this code. Rotate it if it leaks.">
        <div className="flex flex-wrap items-center gap-3">
          <code className="rounded-md bg-[#F6F7F9] px-4 py-2 font-mono text-[18px] font-bold tracking-wider text-ink-900">{show ? q.data?.joinCode ?? '—' : '••••••-••••••'}</code>
          <button className="btn btn-outline h-9" onClick={() => setShow(!show)}>{show ? <EyeSlash size={16} /> : <Eye size={16} />}{show ? 'Hide' : 'Show'}</button>
          {show && q.data?.joinCode && <button className="btn btn-outline h-9" onClick={() => { navigator.clipboard.writeText(q.data!.joinCode!); toast.ok('Copied'); }}>Copy</button>}
          <button className="btn btn-outline h-9" onClick={rotate}><ArrowsClockwise size={16} />Rotate</button>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-500">Change member roles, reset passwords and deactivate accounts on the <Link href="/team" className="font-semibold text-fdr-red underline">Team</Link> roster.</p>
      </Section>
    </>
  );
}

interface Profile { id: string; name: string; program: string; years: string; active: boolean; rules: { name: string; manualUrl?: string; qnaUrl?: string; rules: Record<string, { value: unknown; ruleRef?: string; verified: boolean; note?: string }>; match?: { field: string; autonomousSec: number; driverSec: number; verified: boolean }; notes?: string } }
const RULE_LABEL: Record<string, string> = { startSizeIn: 'Starting size (in, L×W×H)', maxMotorPowerW: 'Max motor power (W)', smartPorts: 'Smart ports', threeWirePorts: '3-wire ports', brainCount: 'Brains', batteryCount: 'Batteries', maxAirTanks: 'Air tanks', maxPsi: 'Max PSI', printedFunctionalPartsLegal: 'Functional 3D-printed parts legal' };

export function SeasonTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-season'], queryFn: () => api.get<{ profiles: Profile[] }>('/api/admin/season') });
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<Profile['rules'] | null>(null);
  const p = q.data?.profiles.find((x) => x.id === sel) ?? q.data?.profiles.find((x) => x.active) ?? q.data?.profiles[0];
  useEffect(() => { if (p) setDraft(structuredClone(p.rules)); }, [p?.id, q.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async (activate = false) => {
    if (!p || !draft) return;
    try { await api.put('/api/admin/season', { id: p.id, rules: draft, activate }); qc.invalidateQueries({ queryKey: ['admin-season'] }); qc.invalidateQueries({ queryKey: ['derived'] }); toast.ok(activate ? `${draft.name} is now the active season` : 'Season rules saved'); }
    catch (e) { toast.error('Could not save', (e as ClientError).message); }
  };
  if (!p || !draft) return <Spinner />;
  const setRule = (k: string, patch: Partial<Profile['rules']['rules'][string]>) => setDraft({ ...draft, rules: { ...draft.rules, [k]: { ...draft.rules[k], ...patch } } });
  return (
    <Section title="Season rules" desc="The numbers every rule check uses. Mark a value verified once you've checked it against the current Game Manual and Q&A.">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input h-9 w-auto" value={p.id} onChange={(e) => setSel(e.target.value)}>{q.data?.profiles.map((x) => <option key={x.id} value={x.id}>{x.rules.name ?? x.name} ({x.program} {x.years}){x.active ? ' — active' : ''}</option>)}</select>
        {!p.active && <button className="btn btn-outline h-9" onClick={() => save(true)}>Make active</button>}
      </div>
      <div className="grid max-w-[760px] gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Season name"><input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
          <Field label="Game Manual URL"><input className="input" value={draft.manualUrl ?? ''} onChange={(e) => setDraft({ ...draft, manualUrl: e.target.value })} /></Field>
        </div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="py-1">Rule</th><th>Value</th><th>Rule ref</th><th className="text-center">Verified</th></tr></thead>
          <tbody className="divide-y divide-line">
            {Object.entries(draft.rules).map(([k, r]) => (
              <tr key={k}>
                <td className="py-2 pr-2 text-ink-800">{RULE_LABEL[k] ?? k}{r.note && <div className="text-[11px] text-ink-400">{r.note}</div>}</td>
                <td className="pr-2">
                  {typeof r.value === 'boolean' ? <Switch checked={r.value} onCheckedChange={(v) => setRule(k, { value: v })} label={k} />
                    : Array.isArray(r.value) ? <div className="flex gap-1">{(r.value as number[]).map((n, i) => <input key={i} type="number" className="input h-8 w-16 px-2 py-0" value={n} onChange={(e) => setRule(k, { value: (r.value as number[]).map((x, j) => (j === i ? Number(e.target.value) : x)) })} />)}</div>
                    : <input type="number" className="input h-8 w-24 px-2 py-0" value={Number(r.value)} onChange={(e) => setRule(k, { value: Number(e.target.value) })} />}
                </td>
                <td className="pr-2"><input className="input h-8 w-24 px-2 py-0 font-mono text-[12px]" value={r.ruleRef ?? ''} onChange={(e) => setRule(k, { ruleRef: e.target.value })} /></td>
                <td className="text-center"><input type="checkbox" className="h-4 w-4 accent-[#1FA84F]" checked={r.verified} onChange={(e) => setRule(k, { verified: e.target.checked })} aria-label={`${k} verified`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {draft.match && (
          <div className="grid grid-cols-3 gap-3">
            <Field label="Autonomous (s)"><input type="number" className="input" value={draft.match.autonomousSec} onChange={(e) => setDraft({ ...draft, match: { ...draft.match!, autonomousSec: Number(e.target.value) } })} /></Field>
            <Field label="Driver control (s)"><input type="number" className="input" value={draft.match.driverSec} onChange={(e) => setDraft({ ...draft, match: { ...draft.match!, driverSec: Number(e.target.value) } })} /></Field>
            <label className="flex items-end gap-2 pb-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[#1FA84F]" checked={draft.match.verified} onChange={(e) => setDraft({ ...draft, match: { ...draft.match!, verified: e.target.checked } })} />Verified</label>
          </div>
        )}
        <button className="btn btn-primary h-10 w-fit px-5" onClick={() => save(false)}>Save rules</button>
      </div>
    </Section>
  );
}

function PrinterDialog({ printer, open, onClose }: { printer: PrinterView | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const blank = { name: '', model: '', adapter: 'simulated', baseUrl: '', apiKey: '', materials: ['PLA', 'PETG'], bed: [256, 256, 256], throughput: 0.35 };
  const [f, setF] = useState(blank);
  useEffect(() => { if (open) setF(printer ? { name: printer.name, model: printer.model, adapter: printer.adapter, baseUrl: printer.baseUrl ?? '', apiKey: '', materials: printer.materials, bed: printer.bedMm, throughput: printer.throughputGPerMin } : blank); }, [open, printer]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    const body = { name: f.name, model: f.model, adapter: f.adapter, baseUrl: f.adapter === 'simulated' ? null : f.baseUrl || null, ...(f.apiKey ? { apiKey: f.apiKey } : {}), materials: f.materials, bedMm: f.bed, throughputGPerMin: f.throughput };
    try { if (printer) await api.patch(`/api/printers/${printer.id}`, body); else await api.post('/api/printers', body); qc.invalidateQueries({ queryKey: ['printers'] }); toast.ok(printer ? 'Printer saved' : 'Printer added'); onClose(); }
    catch (e) { toast.error('Could not save', (e as ClientError).message); }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={printer ? `Edit ${printer.name}` : 'Add printer'} width={560} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!f.name || !f.model || !f.materials.length} onClick={save}>Save</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name"><input className="input" maxLength={40} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Model"><input className="input" maxLength={60} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="Prusa MK4" /></Field>
        <Field label="Connection"><select className="input" value={f.adapter} onChange={(e) => setF({ ...f, adapter: e.target.value })}><option value="simulated">Simulated</option><option value="octoprint">OctoPrint</option><option value="moonraker">Moonraker (Klipper)</option></select></Field>
        <Field label="Speed (g/min)" hint="Used for time estimates"><input type="number" step="0.05" className="input" value={f.throughput} onChange={(e) => setF({ ...f, throughput: Number(e.target.value) })} /></Field>
        {f.adapter !== 'simulated' && <>
          <div className="col-span-2"><Field label="Printer URL"><input className="input" value={f.baseUrl} onChange={(e) => setF({ ...f, baseUrl: e.target.value })} placeholder="http://192.168.1.50" /></Field></div>
          {f.adapter === 'octoprint' && <div className="col-span-2"><Field label={`API key${printer?.hasApiKey ? ' (leave blank to keep)' : ''}`}><input className="input" type="password" value={f.apiKey} onChange={(e) => setF({ ...f, apiKey: e.target.value })} /></Field></div>}
        </>}
        <div className="col-span-2"><div className="label mb-1.5">Materials loaded</div><div className="flex flex-wrap gap-2">{MATERIALS.map((m) => <label key={m} className="flex items-center gap-1.5 text-[13px]"><input type="checkbox" className="accent-[#C8061C]" checked={f.materials.includes(m)} onChange={(e) => setF({ ...f, materials: e.target.checked ? [...f.materials, m] : f.materials.filter((x) => x !== m) })} />{m}</label>)}</div></div>
        <div className="col-span-2"><div className="label mb-1.5">Bed size (mm)</div><div className="flex gap-2">{f.bed.map((n, i) => <input key={i} type="number" className="input w-24" value={n} onChange={(e) => setF({ ...f, bed: f.bed.map((x, j) => (j === i ? Number(e.target.value) : x)) as [number, number, number] })} />)}</div></div>
      </div>
    </Dialog>
  );
}

export function PrintersTab() {
  const qc = useQueryClient();
  const q = usePrinters();
  const [edit, setEdit] = useState<PrinterView | null>(null);
  const [adding, setAdding] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok?: string) => { try { const r = await fn(); qc.invalidateQueries({ queryKey: ['printers'] }); qc.invalidateQueries({ queryKey: ['jobs'] }); if (ok) toast.ok(ok); return r; } catch (e) { toast.error('That didn’t work', (e as ClientError).message); } };
  const test = async (p: PrinterView) => { const r = await run(() => api.post<{ ok: boolean; message: string }>(`/api/printers/${p.id}/test`)) as { ok: boolean; message: string } | undefined; if (r) (r.ok ? toast.ok : toast.error)(r.ok ? 'Connected' : 'Not reachable', r.message); };
  return (
    <Section title="Printers" desc="Simulated printers run on a timer — great for practice. OctoPrint and Moonraker printers receive the STL and report real progress.">
      <div className="mb-3"><button className="btn btn-primary h-9" onClick={() => setAdding(true)}><Plus size={15} />Add printer</button></div>
      <ul className="grid gap-2">
        {q.data?.printers.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-[8px] border border-line px-4 py-3">
            <span className={`h-2.5 w-2.5 rounded-full ${p.state === 'offline' ? 'bg-ink-300' : p.state === 'idle' ? 'bg-ok' : 'bg-[#1F6FD1]'}`} />
            <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-ink-900">{p.name} <span className="font-normal text-ink-500">· {p.model}</span></div><div className="text-[12px] text-ink-500">{p.adapter} · {p.materials.join(', ')} · {p.state}{p.lastSeenAt && p.adapter !== 'simulated' ? ` · seen ${timeAgo(p.lastSeenAt)}` : ''}</div></div>
            {p.adapter === 'simulated' ? (
              <div className="flex flex-wrap gap-1.5">
                <button className="btn btn-outline h-8 text-[12px]" onClick={() => run(() => api.post(`/api/printers/${p.id}/sim`, { action: p.online ? 'offline' : 'online' }), p.online ? 'Taken offline' : 'Back online')}>{p.online ? 'Go offline' : 'Go online'}</button>
                <button className="btn btn-outline h-8 text-[12px]" onClick={() => run(() => api.post(`/api/printers/${p.id}/sim`, { action: p.simFrozen ? 'unfreeze' : 'freeze' }), p.simFrozen ? 'Clock running' : 'Clock frozen')}>{p.simFrozen ? 'Unfreeze' : 'Freeze clock'}</button>
                {p.job && <button className="btn btn-outline h-8 text-[12px]" onClick={() => run(() => api.post(`/api/printers/${p.id}/sim`, { action: 'finish' }), 'Job finished')}>Finish job now</button>}
              </div>
            ) : <button className="btn btn-outline h-8 text-[12px]" onClick={() => test(p)}>Test connection</button>}
            <button className="btn btn-outline h-8 text-[12px]" onClick={() => setEdit(p)}>Edit</button>
            <button aria-label={`Delete ${p.name}`} className="btn btn-outline h-8 w-8 p-0 text-fdr-red" onClick={() => { if (confirm(`Remove ${p.name}?`)) run(() => api.del(`/api/printers/${p.id}`), 'Removed'); }}><Trash size={14} /></button>
          </li>
        ))}
      </ul>
      <PrinterDialog printer={edit} open={adding || !!edit} onClose={() => { setAdding(false); setEdit(null); }} />
    </Section>
  );
}

interface AiAdmin { mode: { configured: boolean; demo: boolean; targets: string[] }; targets: { name: string; kind: string; model: string; status: string; apiVersion: string | null; dropped: string[]; lastError: string | null; lastLatency: number | null }[]; limits: { perHour: number; perDay: number; teamDaily: number }; escalateToCoach: boolean; usage: { userId: string; name: string; day: string; requests: number; tokensIn: number; tokensOut: number }[]; flags: { id: string; status: string; reason: string | null; createdAt: number; user: string; content: string; model: string | null }[] }

export function AiUsageTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-ai'], queryFn: () => api.get<AiAdmin>('/api/admin/ai') });
  const [limits, setLimits] = useState<AiAdmin['limits'] | null>(null);
  const [pinging, setPinging] = useState(false);
  useEffect(() => { if (q.data) setLimits(q.data.limits); }, [q.data]);
  const d = q.data;
  const ping = async () => { setPinging(true); try { await api.get('/api/ai/health?ping=1'); await q.refetch(); } finally { setPinging(false); } };
  const saveLimits = async () => { try { await api.patch('/api/admin/ai', { limits }); toast.ok('Limits saved'); } catch (e) { toast.error('Could not save', (e as ClientError).message); } };
  const flag = async (id: string, status: string) => { try { await api.patch(`/api/admin/flags/${id}`, { status }); qc.invalidateQueries({ queryKey: ['admin-ai'] }); } catch (e) { toast.error('Could not update', (e as ClientError).message); } };
  if (!d || !limits) return <Spinner />;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Section title="AI providers" desc="Requests try each target in order: Azure primary → primary fallback → backup → OpenAI.">
        {d.mode.demo && <div className="mb-3 flex gap-2 rounded-md bg-[#FFF8E1] px-3 py-2 text-[13px] text-[#6B4E00]"><Warning size={18} className="shrink-0" />{LOCAL ? 'Demo mode: this GitHub Pages version runs entirely in your browser and can’t hold AI keys, so the mentor uses built-in answers. Host the app (DEPLOY.md) to use GPT.' : 'Demo mode: no AI keys are set (or AI_MOCK=1), so the mentor uses built-in answers. Add AZURE_OPENAI_* or OPENAI_API_KEY to .env and restart.'}</div>}
        {d.targets.length ? (
          <ul className="grid gap-2">{d.targets.map((t) => (
            <li key={t.name} className="flex flex-wrap items-center gap-3 rounded-[8px] border border-line px-4 py-2.5 text-[13px]">
              {t.status === 'healthy' ? <CheckCircle size={18} weight="fill" className="text-ok" /> : t.status === 'unknown' ? <span className="h-[18px] w-[18px] rounded-full border-2 border-ink-300" /> : <XCircle size={18} weight="fill" className="text-fdr-red" />}
              <b>{t.name}</b><span className="text-ink-500">{t.kind} · {t.model}{t.apiVersion ? ` · api ${t.apiVersion}` : ''}{t.lastLatency ? ` · ${t.lastLatency} ms` : ''}</span>
              <Badge tone={t.status === 'healthy' ? 'green' : t.status === 'unknown' ? 'grey' : 'red'}>{t.status}</Badge>
              {t.lastError && <span className="w-full text-[12px] text-fdr-red">{t.lastError}</span>}
            </li>
          ))}</ul>
        ) : <p className="text-[13px] text-ink-500">No targets configured.</p>}
        {d.mode.configured && <button className="btn btn-outline mt-3 h-9" disabled={pinging} onClick={ping}>{pinging ? <Spinner /> : <ArrowsClockwise size={15} />}Test now</button>}
      </Section>
      <Section title="Limits" desc="Per-student and whole-team caps on mentor requests.">
        <div className="grid max-w-[560px] grid-cols-3 gap-3">
          <Field label="Per student / hour"><input type="number" className="input" value={limits.perHour} onChange={(e) => setLimits({ ...limits, perHour: Number(e.target.value) })} /></Field>
          <Field label="Per student / day"><input type="number" className="input" value={limits.perDay} onChange={(e) => setLimits({ ...limits, perDay: Number(e.target.value) })} /></Field>
          <Field label="Whole team / day"><input type="number" className="input" value={limits.teamDaily} onChange={(e) => setLimits({ ...limits, teamDaily: Number(e.target.value) })} /></Field>
        </div>
        <label className="mt-3 flex max-w-[560px] items-center justify-between rounded-[8px] border border-line px-4 py-3 text-[13px]"><span><b>Tell the coach about crisis messages</b><span className="block text-[12px] text-ink-500">If a student writes something that looks like self-harm, notify admins (the student always sees 988 resources).</span></span><Switch checked={d.escalateToCoach} onCheckedChange={async (v) => { await api.patch('/api/admin/ai', { escalateToCoach: v }); qc.invalidateQueries({ queryKey: ['admin-ai'] }); }} label="Escalate to coach" /></label>
        <button className="btn btn-primary mt-3 h-10 px-5" onClick={saveLimits}>Save limits</button>
      </Section>
      <Section title="Usage (last 14 days)">
        {d.usage.length ? (
          <table className="w-full max-w-[720px] text-[13px]"><thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="py-1">Day</th><th>Student</th><th className="text-right">Requests</th><th className="text-right">Tokens in</th><th className="text-right">Tokens out</th></tr></thead>
            <tbody className="divide-y divide-line">{d.usage.map((u) => <tr key={u.userId + u.day} className={u.day === today ? 'font-semibold' : ''}><td className="py-1.5">{u.day}</td><td>{u.name}</td><td className="tabular text-right">{u.requests}</td><td className="tabular text-right">{u.tokensIn.toLocaleString()}</td><td className="tabular text-right">{u.tokensOut.toLocaleString()}</td></tr>)}</tbody></table>
        ) : <p className="text-[13px] text-ink-500">No mentor requests yet.</p>}
      </Section>
      <Section title="Flagged messages" desc="Answers students reported as wrong or inappropriate.">
        {d.flags.length ? <ul className="grid gap-2">{d.flags.map((f) => (
          <li key={f.id} className={`rounded-[8px] border px-4 py-3 text-[13px] ${f.status === 'open' ? 'border-[#F3C2C2] bg-[#FFFAFA]' : 'border-line opacity-70'}`}>
            <div className="mb-1 flex flex-wrap items-center gap-2"><b>{f.user}</b><span className="text-ink-500">{timeAgo(f.createdAt)}{f.model ? ` · ${f.model}` : ''}</span><Badge tone={f.status === 'open' ? 'red' : 'grey'}>{f.status}</Badge>{f.reason && <span className="text-ink-600">“{f.reason}”</span>}</div>
            <p className="whitespace-pre-wrap text-ink-700">{f.content}</p>
            {f.status === 'open' && <div className="mt-2 flex gap-2"><button className="btn btn-outline h-7 text-[12px]" onClick={() => flag(f.id, 'reviewed')}>Mark reviewed</button><button className="btn btn-ghost h-7 text-[12px]" onClick={() => flag(f.id, 'dismissed')}>Dismiss</button></div>}
          </li>
        ))}</ul> : <p className="text-[13px] text-ink-500">Nothing flagged.</p>}
      </Section>
    </>
  );
}

export function KnowledgeTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-knowledge'], queryFn: () => api.get<{ docs: { id: string; title: string; filename: string; kind: string; chunks: number; embedded: number; ruleIds: number; createdAt: number }[] }>('/api/admin/knowledge') });
  const [busy, setBusy] = useState<string | null>(null);
  const reindex = async (id: string) => { setBusy(id); try { const r = await api.post<{ chunks: number }>(`/api/admin/knowledge/${id}/reindex`); qc.invalidateQueries({ queryKey: ['admin-knowledge'] }); toast.ok(`Re-indexed: ${r.chunks} sections`); } catch (e) { toast.error('Could not re-index', (e as ClientError).message); } finally { setBusy(null); } };
  return (
    <Section title="Knowledge base" desc="Documents the mentor can quote. Turn documents on with “Use for AI” in Resources.">
      {q.isLoading ? <Spinner /> : q.data?.docs.length ? (
        <table className="w-full text-[13px]"><thead className="text-left text-[11px] uppercase tracking-wider text-ink-500"><tr><th className="py-1">Document</th><th className="text-right">Sections</th><th className="text-right">Embedded</th><th className="text-right">Rule IDs</th><th /></tr></thead>
          <tbody className="divide-y divide-line">{q.data.docs.map((d) => <tr key={d.id}><td className="py-2">{d.title}<div className="text-[11.5px] text-ink-400">{d.filename}</div></td><td className="tabular text-right">{d.chunks}</td><td className="tabular text-right">{d.embedded ? d.embedded : <span className="text-ink-400">keyword</span>}</td><td className="tabular text-right">{d.ruleIds}</td><td className="text-right"><button className="btn btn-outline h-8 text-[12px]" disabled={busy === d.id} onClick={() => reindex(d.id)}>{busy === d.id ? <Spinner size={13} /> : <ArrowsClockwise size={14} />}Re-index</button></td></tr>)}</tbody></table>
      ) : <p className="text-[13px] text-ink-500">No documents yet. Upload the Game Manual in <Link className="font-semibold text-fdr-red underline" href="/resources">Resources</Link> and switch on “Use for AI”.</p>}
    </Section>
  );
}

export function DataTab() {
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const doImport = async (f?: File) => {
    if (!f) return;
    if (!confirm('Importing replaces builds, parts, inventory, tasks, competitions and other team content with the file’s contents. Accounts stay the same. Continue?')) return;
    setBusy(true);
    try {
      const r = await fetch(`${BASE}/api/admin/import`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: await f.text() });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error?.message ?? 'Import failed');
      qc.invalidateQueries(); toast.ok('Import complete', `${Object.values(j.counts as Record<string, number>).reduce((a, b) => a + b, 0)} rows restored`);
    } catch (e) { toast.error('Import failed', (e as Error).message); } finally { setBusy(false); }
  };
  const resetLocal = async () => {
    if (!confirm('Delete all builds, parts, files and settings saved in this browser and start again with the demo team? Export first if you want to keep anything.')) return;
    setBusy(true);
    try { await api.post('/api/local/reset'); localStorage.removeItem(SIGNED_OUT_KEY); location.href = `${BASE}/`; }
    catch (e) { toast.error('Reset failed', (e as Error).message); setBusy(false); }
  };
  return (
    <Section title="Data" desc={LOCAL ? 'This copy of the Hub is saved in this browser only. Export it to keep a backup or to move it to another computer.' : 'Back up everything regularly — especially before the season starts.'}>
      <div className="grid max-w-[640px] gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-line px-4 py-3"><span className="text-[13px]"><b>Export all data</b><span className="block text-[12px] text-ink-500">JSON of every table (passwords excluded)</span></span><button className="btn btn-outline h-9" onClick={() => download('/api/admin/export')}><DownloadSimple size={16} />Export JSON</button></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-line px-4 py-3"><span className="text-[13px]"><b>Import</b><span className="block text-[12px] text-ink-500">Restore team content from an export file</span></span><input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ''; }} /><button className="btn btn-outline h-9" disabled={busy} onClick={() => file.current?.click()}>{busy ? <Spinner /> : <FileArrowUp size={16} />}Import JSON</button></div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-line px-4 py-3"><span className="text-[13px]"><b>Database backup</b><span className="block text-[12px] text-ink-500">A full copy of the SQLite database file</span></span><button className="btn btn-outline h-9" onClick={() => download('/api/admin/backup')}><DownloadSimple size={16} />Download backup</button></div>
        {LOCAL && <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-line px-4 py-3"><span className="text-[13px]"><b>Start over</b><span className="block text-[12px] text-ink-500">Delete everything saved in this browser and reload the demo team</span></span><button className="btn btn-outline h-9 text-fdr-red" disabled={busy} onClick={resetLocal}><Trash size={16} />Reset this browser</button></div>}
      </div>
    </Section>
  );
}
