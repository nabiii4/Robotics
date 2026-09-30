'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { ArrowRight, Brain, CheckCircle, Copy, Cube, Flag, Printer, Stop, ThumbsDown, ThumbsUp, Warning, WarningCircle, XCircle, ArrowCounterClockwise, Code as CodeIcon, Package } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { OVERRIDE } from '@/lib/robot/seasons';
import { LEGALITY_BADGE } from '@/lib/printing/templates';
import { Badge, Spinner } from '../ui/bits';
import { toast } from '../ui/Toast';
import { Dialog } from '../ui/Dialog';
import { useMe } from '../shell/AppShell';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Msg { id: string; role: 'user' | 'assistant' | 'note'; content: string; createdAt: number; envelope?: any; applied?: any; pendingDone?: Record<string, any>; feedback?: number | null; flagged?: boolean; model?: string | null; target?: string | null; pending?: boolean; error?: { message: string; retryMessageId?: string } }

const STAGES = ['Reading your build…', 'Thinking…', 'Checking rules…', 'Updating 3D model…'];
export const QUICK_CHIPS = [
  { id: 'design-tips', label: 'Design tips' }, { id: 'code-help', label: 'VEX code help' }, { id: 'troubleshoot', label: 'Troubleshoot' }, { id: 'rules', label: 'Competition rules' },
];

function ruleLinks(md: string) {
  const tpl = OVERRIDE.manualRuleUrlTemplate ?? '';
  return md.replace(/<([A-Z]{1,4}\d{1,2}[a-z]?)>/g, (_, id) => `[‹${id}›](${tpl.replace('{id}', id)})`);
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md text-[13.5px] leading-[1.55] text-ink-900">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]} components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a> }}>{ruleLinks(text)}</ReactMarkdown>
    </div>
  );
}

function useAction(msg: Msg, onUpdate: (m: Msg) => void, buildId: string | null) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (action: string, index = 0, okText?: string) => {
    setBusy(`${action}:${index}`);
    try {
      const r = await api.post<any>(`/api/ai/pending/${msg.id}/${action}`, { index });
      if (r.message) onUpdate({ ...msg, ...r.message });
      qc.invalidateQueries({ queryKey: ['derived'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['build'] });
      if (action === 'apply-code') qc.invalidateQueries({ queryKey: ['code'] });
      if (action === 'send-to-printer') qc.invalidateQueries({ queryKey: ['jobs'] });
      if (action === 'undo-memory') qc.invalidateQueries({ queryKey: ['memories'] });
      toast.ok(okText ?? 'Done');
      return r;
    } catch (e) {
      toast.error('That didn’t work', (e as ClientError).message);
    } finally { setBusy(null); }
    void buildId;
  };
  return { busy, run, done: (k: string) => !!msg.pendingDone?.[k] };
}

function DesignChangeCard({ msg, onUpdate, buildId }: { msg: Msg; onUpdate: (m: Msg) => void; buildId: string | null }) {
  const a = msg.applied;
  const router = useRouter();
  const { busy, run, done } = useAction(msg, onUpdate, buildId);
  const checks = (a.ruleSummary ?? []) as { id: string; pass: boolean; severity: string; title: string }[];
  const shown = checks.filter((c) => ['size.start', 'power.motors', 'printed.legality', 'geometry.collisions'].includes(c.id));
  return (
    <div className="mt-2 rounded-[10px] border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="flex items-center gap-2 text-[12.5px] font-bold text-ink-900"><Cube size={16} weight="fill" className="text-fdr-red-bright" />Design change {a.previousVersion ? `v${a.previousVersion} → ` : ''}v{a.version}</span>
        <Badge tone="green">Applied</Badge>
      </div>
      <ul className="space-y-1 px-3 py-2 text-[12.5px] text-ink-800">{(a.diff ?? []).slice(0, 8).map((d: string, i: number) => <li key={i} className="flex gap-1.5"><span className="text-ink-400">•</span>{d}</li>)}</ul>
      {shown.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {shown.map((c) => <span key={c.id} className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] ${c.pass ? 'bg-ok-50 text-ok-ink' : c.severity === 'error' ? 'bg-fdr-red-50 text-fdr-red' : 'bg-[#FFF6D6] text-[#8A6400]'}`}>{c.pass ? <CheckCircle size={12} weight="fill" /> : <Warning size={12} weight="fill" />}{c.title}</span>)}
        </div>
      )}
      {(a.normalizeReport ?? []).length > 0 && <div className="px-3 pb-2 text-[11.5px] text-ink-500">{(a.normalizeReport as any[]).slice(0, 3).map((n, i) => <div key={i}>Adjusted {n.path}: {String(n.from)} → {String(n.to)} ({n.reason})</div>)}</div>}
      <div className="flex gap-2 border-t border-line px-3 py-2">
        {buildId && <button className="btn btn-outline h-8 px-3 text-[12.5px]" onClick={() => router.push(`/builds/${buildId}?tab=3d`)}><Cube size={14} />View in 3D</button>}
        {a.previousVersionId && <button className="btn btn-ghost h-8 px-3 text-[12.5px]" disabled={done('undo:0') || !!busy} onClick={() => run('undo', 0, `Restored v${a.previousVersion}`)}>{busy === 'undo:0' ? <Spinner size={13} /> : <ArrowCounterClockwise size={14} />}{done('undo:0') ? 'Undone' : 'Undo'}</button>}
      </div>
    </div>
  );
}

function NotAppliedCard({ msg, onUpdate, buildId }: { msg: Msg; onUpdate: (m: Msg) => void; buildId: string | null }) {
  const na = msg.applied.notApplied;
  const { busy, run, done } = useAction(msg, onUpdate, buildId);
  return (
    <div className="mt-2 rounded-[10px] border border-fdr-red-100 bg-fdr-red-tint">
      <div className="flex items-center gap-2 px-3 py-2 text-[12.5px] font-bold text-fdr-red"><XCircle size={16} weight="fill" />Design not applied</div>
      <ul className="space-y-1 px-3 pb-2 text-[12.5px] text-ink-800">{(na.failures ?? []).map((f: any) => <li key={f.id}><span className="font-semibold">{f.title}</span>{f.detail ? <span className="text-ink-500"> — {f.detail}</span> : null}</li>)}</ul>
      {na.spec && <div className="border-t border-fdr-red-100 px-3 py-2"><button className="btn btn-outline h-8 px-3 text-[12.5px]" disabled={done('apply-practice:0') || !!busy} onClick={() => run('apply-practice', 0, 'Applied as a Practice design')}>{busy ? <Spinner size={13} /> : null}{done('apply-practice:0') ? 'Applied as Practice' : 'Apply as Practice design'}</button></div>}
    </div>
  );
}

function PartsCard({ msg, onUpdate, buildId }: { msg: Msg; onUpdate: (m: Msg) => void; buildId: string | null }) {
  const { busy, run, done } = useAction(msg, onUpdate, buildId);
  const parts = msg.envelope.customParts as any[];
  return (
    <div className="mt-2 space-y-2">
      {parts.map((p, i) => (
        <div key={i} className="rounded-[10px] border border-line bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[13px] font-bold">{p.name} <span className="font-normal text-ink-500">· {p.template} · {p.material} {p.color} × {p.quantity}</span></div>
              <div className="mt-0.5 text-[12px] text-ink-500">{p.purpose}</div>
              <div className="mt-1 font-mono text-[11px] text-ink-400">{Object.entries(p.params ?? {}).map(([k, v]) => `${k}=${v}`).join('  ')}</div>
            </div>
            <Badge tone="grey">{LEGALITY_BADGE.practice.label}</Badge>
          </div>
          <div className="mt-2 flex gap-2">
            <button className="btn btn-outline h-8 px-3 text-[12.5px]" disabled={!buildId || done(`add-part:${i}`) || !!busy} onClick={() => run('add-part', i, `${p.name} added to the build`)}>{busy === `add-part:${i}` ? <Spinner size={13} /> : <Package size={14} />}{done(`add-part:${i}`) ? 'Added' : 'Add to build'}</button>
            <button className="btn btn-primary h-8 px-3 text-[12.5px]" disabled={!done(`add-part:${i}`) || done(`send-to-printer:${i}`) || !!busy} onClick={() => run('send-to-printer', i, 'Sent to the print queue')}><Printer size={14} />{done(`send-to-printer:${i}`) ? 'Queued' : 'Send to printer'}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CodeCard({ msg, onUpdate, buildId }: { msg: Msg; onUpdate: (m: Msg) => void; buildId: string | null }) {
  const cs = msg.envelope.codeSuggestion;
  const [diff, setDiff] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const { busy, run, done } = useAction(msg, onUpdate, buildId);
  const openDiff = async () => {
    setDiff(true);
    if (buildId) {
      try {
        const r = await api.get<{ files: { path: string; content: string }[] }>(`/api/builds/${buildId}/code`);
        setCurrent(r.files.find((f) => f.path === cs.path)?.content ?? '');
      } catch { setCurrent(''); }
    }
  };
  return (
    <div className="mt-2 rounded-[10px] border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-[12.5px] font-bold"><span className="flex items-center gap-2"><CodeIcon size={16} weight="bold" className="text-fdr-red-bright" />{cs.path}</span></div>
      {cs.explanation && <p className="px-3 pt-2 text-[12.5px] text-ink-600">{cs.explanation}</p>}
      <pre className="scroll-thin m-3 max-h-56 overflow-auto rounded-md bg-code-bg p-3 font-mono text-[11.5px] leading-[1.5] text-[#D4D4D4]">{cs.code}</pre>
      <div className="flex gap-2 border-t border-line px-3 py-2">
        <button className="btn btn-primary h-8 px-3 text-[12.5px]" disabled={!buildId || done('apply-code:0')} onClick={openDiff}>{done('apply-code:0') ? 'Applied' : 'Preview diff & apply'}</button>
        <button className="btn btn-ghost h-8 px-3 text-[12.5px]" onClick={() => { navigator.clipboard.writeText(cs.code); toast.ok('Copied'); }}><Copy size={14} />Copy</button>
      </div>
      <Dialog open={diff} onOpenChange={setDiff} title={`Apply to ${cs.path}?`} width={900} footer={<><button className="btn btn-outline h-9 px-4" onClick={() => setDiff(false)}>Cancel</button><button className="btn btn-primary h-9 px-4" disabled={!!busy} onClick={async () => { await run('apply-code', 0, `${cs.path} updated`); setDiff(false); }}>{busy ? <Spinner size={14} /> : 'Apply'}</button></>}>
        <DiffView before={current ?? ''} after={cs.code} />
      </Dialog>
    </div>
  );
}

export function DiffView({ before, after }: { before: string; after: string }) {
  const a = before.split('\n'), b = after.split('\n');
  // LCS line diff
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const rows: { t: ' ' | '+' | '-'; s: string }[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { rows.push({ t: ' ', s: a[i] }); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) rows.push({ t: '-', s: a[i++] }); else rows.push({ t: '+', s: b[j++] }); }
  while (i < n) rows.push({ t: '-', s: a[i++] });
  while (j < m) rows.push({ t: '+', s: b[j++] });
  return (
    <pre className="scroll-thin max-h-[60vh] overflow-auto rounded-md bg-code-bg p-3 font-mono text-[12px] leading-[1.55] text-[#D4D4D4]">
      {rows.map((r, k) => <div key={k} className={r.t === '+' ? 'bg-[#1f3b24] text-[#b5e3b9]' : r.t === '-' ? 'bg-[#43201f] text-[#f0b5b3]' : ''}>{r.t} {r.s || ' '}</div>)}
    </pre>
  );
}

function ActionsCard({ msg, onUpdate, buildId }: { msg: Msg; onUpdate: (m: Msg) => void; buildId: string | null }) {
  const { busy, run, done } = useAction(msg, onUpdate, buildId);
  const inv = msg.envelope.inventoryActions as any[];
  return (
    <div className="mt-2 space-y-1.5">
      {inv.map((a, i) => {
        const act = a.type === 'reserve' ? 'reserve' : 'order';
        return (
          <div key={i} className="flex items-center justify-between gap-2 rounded-[10px] border border-line bg-white px-3 py-2 text-[12.5px]">
            <span>{a.type === 'reserve' ? 'Reserve' : 'Add to order list'}: <b>{a.qty} × {a.item}</b></span>
            <button className="btn btn-outline h-7 px-3 text-[12px]" disabled={done(`${act}:${i}`) || !!busy} onClick={() => run(act, i, a.type === 'reserve' ? 'Reserved' : 'Added to the order list')}>{done(`${act}:${i}`) ? 'Done' : 'Confirm'}</button>
          </div>
        );
      })}
    </div>
  );
}

function MemoryNotes({ msg, onUpdate, buildId }: { msg: Msg; onUpdate: (m: Msg) => void; buildId: string | null }) {
  const notes = (msg.envelope?.memoryNotes ?? []) as { id: string; text: string; op: string }[];
  const { run, done } = useAction(msg, onUpdate, buildId);
  if (!notes.length) return null;
  return (
    <div className="mt-2 space-y-1">
      {notes.map((n) => (
        <div key={n.id} className="flex items-center gap-2 text-[12px] text-ink-500">
          <Brain size={14} className="text-ink-400" />
          {n.op === 'forget' ? <span>Mentor forgot: {n.text}</span> : <span>Mentor remembered: {n.text}</span>}
          {n.op !== 'forget' && !done('undo-memory:0') && <button className="font-semibold text-fdr-red hover:underline" onClick={() => run('undo-memory', 0, 'Memory removed')}>Undo</button>}
        </div>
      ))}
    </div>
  );
}

export function MessageView({ msg, onUpdate, buildId, onFollowUp }: { msg: Msg; onUpdate: (m: Msg) => void; buildId: string | null; onFollowUp: (t: string) => void }) {
  const [fb, setFb] = useState(msg.feedback ?? 0);
  if (msg.role === 'user') {
    return <div className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-[12px] rounded-br-[4px] bg-ink-800 px-3 py-2 text-[13.5px] text-white">{msg.content}</div></div>;
  }
  if (msg.pending) return <div className="flex items-center gap-2 text-[13px] text-ink-500"><Spinner size={14} />{msg.content}</div>;
  if (msg.error) {
    return (
      <div className="rounded-[10px] border border-fdr-red-100 bg-fdr-red-tint px-3 py-2 text-[13px] text-ink-800">
        <div className="flex items-start gap-2"><WarningCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-fdr-red" />{msg.error.message}</div>
      </div>
    );
  }
  const e = msg.envelope ?? {};
  const setFeedback = async (v: 1 | -1) => { const nv = fb === v ? 0 : v; setFb(nv); try { await api.post(`/api/ai/messages/${msg.id}/feedback`, { value: nv }); } catch { /* ignore */ } };
  const flag = async () => { if (!confirm('Flag this reply for your coach to review?')) return; await api.post(`/api/ai/messages/${msg.id}/flag`, { reason: '' }); toast.ok('Flagged for review'); onUpdate({ ...msg, flagged: true }); };
  return (
    <div className="group">
      <Markdown text={msg.content} />
      {msg.applied?.version ? <DesignChangeCard msg={msg} onUpdate={onUpdate} buildId={buildId} /> : null}
      {msg.applied?.notApplied ? <NotAppliedCard msg={msg} onUpdate={onUpdate} buildId={buildId} /> : null}
      {e.customParts?.length ? <PartsCard msg={msg} onUpdate={onUpdate} buildId={buildId} /> : null}
      {e.codeSuggestion ? <CodeCard msg={msg} onUpdate={onUpdate} buildId={buildId} /> : null}
      {e.inventoryActions?.length ? <ActionsCard msg={msg} onUpdate={onUpdate} buildId={buildId} /> : null}
      {e.clarifyingQuestion && <div className="mt-2 rounded-md border-l-[3px] border-fdr-red bg-[#F6F7F9] px-3 py-2 text-[13px] font-medium text-ink-900">{e.clarifyingQuestion}</div>}
      <MemoryNotes msg={msg} onUpdate={onUpdate} buildId={buildId} />
      {e.followUps?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{(e.followUps as string[]).map((f) => <button key={f} onClick={() => onFollowUp(f)} className="chip border border-[#D5D8DD] bg-white px-2.5 py-1 text-ink-800 hover:bg-[#F6F7F9]">{f}</button>)}</div> : null}
      <div className="mt-1.5 flex items-center gap-1 text-ink-400 opacity-70 transition-opacity group-hover:opacity-100">
        <button aria-label="Copy reply" onClick={() => { navigator.clipboard.writeText(msg.content); toast.ok('Copied'); }} className="rounded p-1 hover:bg-black/5 hover:text-ink-900"><Copy size={14} /></button>
        <button aria-label="Helpful" aria-pressed={fb === 1} onClick={() => setFeedback(1)} className={`rounded p-1 hover:bg-black/5 ${fb === 1 ? 'text-ok' : 'hover:text-ink-900'}`}><ThumbsUp size={14} weight={fb === 1 ? 'fill' : 'regular'} /></button>
        <button aria-label="Not helpful" aria-pressed={fb === -1} onClick={() => setFeedback(-1)} className={`rounded p-1 hover:bg-black/5 ${fb === -1 ? 'text-fdr-red' : 'hover:text-ink-900'}`}><ThumbsDown size={14} weight={fb === -1 ? 'fill' : 'regular'} /></button>
        <button aria-label="Flag reply" onClick={flag} disabled={msg.flagged} className="rounded p-1 hover:bg-black/5 hover:text-ink-900 disabled:text-fdr-red"><Flag size={14} weight={msg.flagged ? 'fill' : 'regular'} /></button>
        {msg.model === 'demo-mentor' && <span className="ml-1 text-[10.5px]">demo mentor</span>}
      </div>
    </div>
  );
}

/** Conversation + composer. Used by the drawer, the build workspace panel and /mentor. */
export function MentorChat({ threadId, onThread, buildId, initial, chips = QUICK_CHIPS, codeFileId, dense }: {
  threadId: string | null; onThread: (id: string) => void; buildId: string | null; initial?: { text: string; chipId?: string; codeContext?: { fileId: string } } | null;
  chips?: { id: string; label: string }[]; codeFileId?: string | null; dense?: boolean;
}) {
  const { me, aiMode } = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [local, setLocal] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const q = useQuery({ queryKey: ['thread', threadId], queryFn: () => api.get<{ messages: Msg[] }>(`/api/ai/threads/${threadId}`), enabled: !!threadId });
  const server = q.data?.messages ?? [];
  const serverIds = new Set(server.map((m) => m.id));
  const messages = [...server, ...local.filter((m) => !serverIds.has(m.id))];
  const selfThread = useRef<string | null>(null);
  useEffect(() => { if (threadId && threadId === selfThread.current) return; setLocal([]); }, [threadId]);
  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [messages.length, busy]);
  const sentInitial = useRef(false);
  useEffect(() => { if (initial && !sentInitial.current) { sentInitial.current = true; send(initial.text, initial.chipId, initial.codeContext); } }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (m: Msg) => {
    qc.setQueryData(['thread', threadId], (old: { messages: Msg[] } | undefined) => old ? { ...old, messages: old.messages.map((x) => (x.id === m.id ? m : x)) } : old);
    setLocal((l) => l.map((x) => (x.id === m.id ? m : x)));
  };

  async function send(msgText: string, chipId?: string, codeContext?: { fileId: string }, retryMessageId?: string) {
    const t = msgText.trim();
    if ((!t && !chipId) || busy) return;
    setText('');
    setBusy(true); setStage(0);
    const tempUser: Msg = { id: `u-${Date.now()}`, role: 'user', content: t || chips.find((c) => c.id === chipId)?.label || '', createdAt: Date.now() };
    const tempWait: Msg = { id: `w-${Date.now()}`, role: 'assistant', content: STAGES[0], createdAt: Date.now(), pending: true };
    setLocal((l) => [...l.filter((x) => !x.error), ...(retryMessageId ? [] : [tempUser]), tempWait]);
    const timers = [1200, 3500, 7000].map((ms, i) => setTimeout(() => { setStage(i + 1); setLocal((l) => l.map((x) => (x.id === tempWait.id ? { ...x, content: STAGES[i + 1] } : x))); }, ms));
    abort.current = new AbortController();
    try {
      const r = await api.post<{ threadId: string; message: Msg; remaining: number }>('/api/ai/mentor', { threadId, buildId, message: t, chipId, codeContext: codeContext ?? (codeFileId ? { fileId: codeFileId } : null), retryMessageId }, abort.current.signal);
      setLocal((l) => [...l.filter((x) => x.id !== tempWait.id), r.message]);
      if (r.threadId !== threadId) { selfThread.current = r.threadId; onThread(r.threadId); }
      await qc.invalidateQueries({ queryKey: ['thread', r.threadId] });
      qc.invalidateQueries({ queryKey: ['threads'] });
      if (r.message?.applied?.version) {
        qc.invalidateQueries({ queryKey: ['derived'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['build'] });
        qc.invalidateQueries({ queryKey: ['code'] });
        toast.ok(`Design updated to v${r.message.applied.version}`, r.message.applied.diff?.[0], r.message.applied.previousVersionId ? { label: 'Undo', onClick: async () => { await api.post(`/api/ai/pending/${r.message.id}/undo`, { index: 0 }); qc.invalidateQueries({ queryKey: ['derived'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['thread', r.threadId] }); toast.ok('Change undone'); } } : undefined);
      }
      if (r.message?.envelope?.memoryNotes?.length) qc.invalidateQueries({ queryKey: ['memories'] });
      if (r.remaining < 5) toast.info(`${r.remaining} mentor messages left this hour`);
    } catch (e) {
      const err = e as ClientError;
      if ((e as Error).name === 'AbortError') setLocal((l) => l.filter((x) => x.id !== tempWait.id));
      else {
        const details = err.details as { retryMessageId?: string; threadId?: string } | undefined;
        if (details?.threadId && details.threadId !== threadId) { selfThread.current = details.threadId; onThread(details.threadId); }
        setLocal((l) => [...l.filter((x) => x.id !== tempWait.id), { id: `e-${Date.now()}`, role: 'assistant', content: '', createdAt: Date.now(), error: { message: err.message, retryMessageId: details?.retryMessageId } }]);
      }
    } finally {
      timers.forEach(clearTimeout);
      setBusy(false);
      abort.current = null;
    }
  }
  const lastErr = [...local].reverse().find((m) => m.error);
  const firstName = me.displayName.split(' ')[0];
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !q.isLoading && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <img src="/brand/mentor-b.png" alt="" className="h-20 w-20" />
            <p className="max-w-[300px] text-[13.5px] text-ink-600">Hi {firstName}! I'm your FDR Robotics AI mentor. Ask me about your design, code, parts, or competition rules!</p>
            {aiMode.demo && <p className="max-w-[320px] rounded-md bg-[#FFF6D6] px-3 py-1.5 text-[11.5px] text-[#8A6400]">Demo mentor: it understands common design requests. Add an Azure or OpenAI key in .env for full answers.</p>}
          </div>
        )}
        {q.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
        {messages.map((m) => <MessageView key={m.id} msg={m} onUpdate={update} buildId={buildId} onFollowUp={(f) => send(f)} />)}
        {lastErr?.error?.retryMessageId && <button className="btn btn-outline h-8 px-3 text-[12.5px]" onClick={() => send('', undefined, undefined, lastErr.error!.retryMessageId)}>Retry</button>}
      </div>
      <div className="border-t border-line px-3 pb-3 pt-2">
        {!dense && <div className="mb-2 flex flex-wrap gap-1.5">{chips.map((c) => <button key={c.id} disabled={busy} onClick={() => send('', c.id)} className="chip bg-chip-b px-2.5 py-1 text-ink-800 hover:bg-[#E3E9EB] disabled:opacity-40">{c.label}</button>)}</div>}
        <form onSubmit={(ev) => { ev.preventDefault(); send(text); }} className="flex items-end gap-2">
          <label className="sr-only" htmlFor="composer">Message the mentor</label>
          <textarea id="composer" rows={1} value={text} onChange={(ev) => { setText(ev.target.value); ev.target.style.height = 'auto'; ev.target.style.height = `${Math.min(160, ev.target.scrollHeight)}px`; }}
            onKeyDown={(ev) => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); send(text); } }}
            placeholder={buildId ? 'Ask about your build… (e.g. “make it faster”)' : 'Ask the mentor…'} maxLength={4000}
            className="input max-h-40 min-h-[40px] resize-none py-2.5" />
          {busy ? (
            <button type="button" aria-label="Stop" onClick={() => abort.current?.abort()} className="btn btn-outline h-10 w-10 shrink-0"><Stop size={16} weight="fill" /></button>
          ) : (
            <button type="submit" aria-label="Send" disabled={!text.trim()} className="btn btn-primary h-10 w-10 shrink-0"><ArrowRight size={18} weight="bold" /></button>
          )}
        </form>
        {busy && <div className="mt-1 text-[11px] text-ink-400">{STAGES[stage]}</div>}
      </div>
    </div>
  );
}
