'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Copy, FileArrowUp, Sparkle, SquaresFour, Warning, XCircle, Info } from '@phosphor-icons/react';
import { api, ClientError } from '@/lib/client/api';
import { useUI } from '@/lib/client/stores';
import { Dialog } from '../ui/Dialog';
import { Field, Spinner } from '../ui/bits';
import { toast } from '../ui/Toast';
import { useBuilds } from '../mentor/MentorDrawer';

type Program = 'V5RC' | 'VEXU' | 'VAIRC' | 'Practice';
type StartKind = 'ai' | 'template' | 'duplicate' | 'import';
interface Preview { program: string; metrics: [string, string][]; subsystems: string[]; checks: { id: string; severity: string; pass: boolean; title: string; detail: string; ruleRef: string | null }[]; notes: string[] }

const PROGRAMS: { value: Program; label: string; season: string }[] = [
  { value: 'V5RC', label: 'V5RC', season: 'Override 2026–27' },
  { value: 'VEXU', label: 'VEX U', season: 'VEX U 2026–27' },
  { value: 'VAIRC', label: 'VEX AI', season: 'VEX U 2026–27 (VEX AI)' },
  { value: 'Practice', label: 'Practice', season: 'Practice (no size limits)' },
];
const TEMPLATE_CARDS = [
  { id: 'competition-base', label: 'Competition Base', text: '6‑motor 450 rpm, 3.25″ omni, front intake' },
  { id: 'clawbot', label: 'Clawbot‑style Starter', text: '4″ wheels, simple arm with a claw' },
  { id: 'xdrive', label: 'X‑Drive', text: '4 omni wheels at 45°, strafes in any direction' },
  { id: 'mecanum', label: 'Mecanum', text: '4 mecanum wheels, strafing tank layout' },
  { id: 'blank', label: 'Blank Chassis', text: 'Drivetrain only — add mechanisms later' },
];
const STAGES = ['Reading your idea…', 'Choosing drivetrain…', 'Sizing mechanisms…', 'Placing electronics…', 'Checking rules…', 'Drawing the model…'];

export function NewBuildDialog() {
  const { newBuild: open, setNewBuild } = useUI();
  const router = useRouter();
  const qc = useQueryClient();
  const builds = useBuilds();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [program, setProgram] = useState<Program>('V5RC');
  const [visibility, setVisibility] = useState<'team' | 'private'>('team');
  const [kind, setKind] = useState<StartKind>('ai');
  const [prompt, setPrompt] = useState('');
  const [template, setTemplate] = useState('competition-base');
  const [dupId, setDupId] = useState('');
  const [imported, setImported] = useState<{ name: string; spec: unknown } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1); setName(''); setTagline(''); setProgram('V5RC'); setVisibility('team'); setKind('ai'); setPrompt('');
    setTemplate('competition-base'); setDupId(''); setImported(null); setPreview(null); setPreviewErr(null); setBusy(false); setStage(0);
  }, [open]);
  useEffect(() => { if (!dupId && builds.data?.builds[0]) setDupId(builds.data.builds[0].id); }, [builds.data, dupId]);
  useEffect(() => {
    if (!busy || kind !== 'ai') return;
    const t = setInterval(() => setStage((s) => Math.min(STAGES.length - 1, s + 1)), 2200);
    return () => clearInterval(t);
  }, [busy, kind]);

  const start = () => {
    if (kind === 'ai') return { kind, prompt: prompt.trim() };
    if (kind === 'template') return { kind, template };
    if (kind === 'duplicate') return { kind, buildId: dupId };
    return { kind, spec: imported?.spec };
  };
  const step2Valid = kind === 'ai' ? prompt.trim().length >= 3 : kind === 'duplicate' ? !!dupId : kind === 'import' ? !!imported : true;

  const toReview = async () => {
    setStep(3); setPreview(null); setPreviewErr(null);
    if (kind === 'ai') return;
    setLoadingPreview(true);
    try { setPreview(await api.post<Preview>('/api/builds/preview', { name: name.trim(), program, start: start() })); }
    catch (e) { setPreviewErr((e as ClientError).message); }
    finally { setLoadingPreview(false); }
  };

  const create = async () => {
    setBusy(true); setStage(0);
    try {
      const r = await api.post<{ id: string; fallback: boolean }>('/api/builds', { name: name.trim(), tagline: tagline.trim() || null, program, visibility, start: start() });
      qc.invalidateQueries({ queryKey: ['builds'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (r.fallback) toast.info('The mentor couldn’t design it this time', 'We started you from Competition Base instead — ask the mentor to change it.');
      else toast.ok(`${name.trim()} created`);
      setNewBuild(false);
      router.push(`/builds/${r.id}${kind === 'ai' ? '?mentor=1' : ''}`);
    } catch (e) {
      toast.error('Could not create the build', (e as ClientError).message);
      setBusy(false);
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1_000_000) { toast.error('That file is too big', 'RobotSpec JSON files are under 1 MB.'); return; }
    try { const spec = JSON.parse(await f.text()); setImported({ name: f.name, spec }); if (!name && spec?.meta?.name) setName(String(spec.meta.name).slice(0, 60)); }
    catch { toast.error('That isn’t valid JSON', 'Export a RobotSpec from a build’s Export menu and try again.'); }
  };

  const footer = busy ? null : (
    <>
      {step > 1 && <button className="btn btn-outline" onClick={() => setStep(step - 1)}>Back</button>}
      {step === 1 && <button className="btn btn-primary" disabled={!name.trim()} onClick={() => setStep(2)}>Next</button>}
      {step === 2 && <button className="btn btn-primary" disabled={!step2Valid} onClick={toReview}>Review</button>}
      {step === 3 && <button className="btn btn-primary" disabled={!!previewErr || loadingPreview} onClick={create}>{kind === 'ai' ? 'Design it with the Mentor' : 'Create build'}</button>}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) setNewBuild(o); }} title="Start a New Build" description={`Step ${step} of 3 · ${['Name it', 'Choose a starting point', 'Review and create'][step - 1]}`} width={620} footer={footer}>
      {busy ? (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <img src="/brand/mentor-b.png" alt="" className="h-16 w-16 animate-pulse" />
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink-900"><Spinner />{kind === 'ai' ? STAGES[stage] : 'Creating your build…'}</div>
          {kind === 'ai' && <p className="max-w-[380px] text-[13px] text-ink-500">The mentor is designing a legal robot from your description. This usually takes 10–40 seconds.</p>}
        </div>
      ) : step === 1 ? (
        <div className="grid gap-4">
          <Field label="Build name"><input autoFocus className="input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pin Hunter" onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep(2); }} /></Field>
          <Field label="Tagline (optional)"><input className="input" maxLength={80} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Fast intake bot for Override" /></Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Program">
              <select className="input" value={program} onChange={(e) => setProgram(e.target.value as Program)}>{PROGRAMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
            </Field>
            <Field label="Season profile" hint="Picked from the program">
              <input className="input bg-[#F6F7F9]" readOnly value={PROGRAMS.find((p) => p.value === program)?.season} />
            </Field>
          </div>
          <div>
            <div className="label mb-1.5">Visibility</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([['team', 'Team', 'Everyone on the team can see and edit it'], ['private', 'Private sandbox', 'Only you can see it — good for experiments']] as const).map(([v, l, t]) => (
                <button key={v} onClick={() => setVisibility(v)} aria-pressed={visibility === v} className={`rounded-[8px] border p-3 text-left transition-colors ${visibility === v ? 'border-fdr-red bg-[#FFF5F5]' : 'border-line hover:border-ink-300'}`}>
                  <div className="text-[14px] font-semibold text-ink-900">{l}</div><div className="text-[12px] text-ink-500">{t}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : step === 2 ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Starting point">
            {([['ai', 'Describe it', Sparkle], ['template', 'Template', SquaresFour], ['duplicate', 'Duplicate', Copy], ['import', 'Import JSON', FileArrowUp]] as const).map(([k, l, Icon]) => (
              <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`flex flex-col items-center gap-1.5 rounded-[8px] border px-2 py-3 text-[13px] font-semibold ${kind === k ? 'border-fdr-red bg-[#FFF5F5] text-fdr-red' : 'border-line text-ink-800 hover:border-ink-300'}`}><Icon size={22} />{l}</button>
            ))}
          </div>
          {kind === 'ai' && (
            <Field label="Describe your robot to the AI Mentor" hint="Say what it should do, how fast, and any parts you want to use.">
              <textarea autoFocus className="input min-h-[120px] py-2" maxLength={4000} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="A fast 6‑motor robot that can pick up pins and cups" />
            </Field>
          )}
          {kind === 'template' && (
            <div className="grid gap-2">
              {TEMPLATE_CARDS.map((t) => (
                <button key={t.id} onClick={() => setTemplate(t.id)} aria-pressed={template === t.id} className={`flex items-center justify-between rounded-[8px] border px-3 py-2.5 text-left ${template === t.id ? 'border-fdr-red bg-[#FFF5F5]' : 'border-line hover:border-ink-300'}`}>
                  <span><span className="block text-[14px] font-semibold text-ink-900">{t.label}</span><span className="text-[12px] text-ink-500">{t.text}</span></span>
                  {template === t.id && <CheckCircle size={20} weight="fill" className="text-fdr-red" />}
                </button>
              ))}
            </div>
          )}
          {kind === 'duplicate' && (
            <Field label="Copy the current version of">
              <select className="input" value={dupId} onChange={(e) => setDupId(e.target.value)}>
                {(builds.data?.builds ?? []).map((b) => <option key={b.id} value={b.id}>{b.name} — v{b.version}</option>)}
              </select>
            </Field>
          )}
          {kind === 'import' && (
            <div>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-[8px] border-2 border-dashed border-line px-4 py-8 text-[13px] text-ink-500 hover:border-ink-300"
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
                <FileArrowUp size={28} />{imported ? <span className="font-semibold text-ink-900">{imported.name}</span> : 'Drop a RobotSpec .json here or click to choose'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-[8px] bg-[#F6F7F9] px-4 py-3">
            <div className="text-[16px] font-bold text-ink-900">{name}</div>
            <div className="text-[12.5px] text-ink-500">{PROGRAMS.find((p) => p.value === program)?.label} · {visibility === 'team' ? 'Team build' : 'Private sandbox'}{tagline ? ` · ${tagline}` : ''}</div>
          </div>
          {kind === 'ai' ? (
            <div className="rounded-[8px] border border-line p-4">
              <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-ink-900"><Sparkle size={16} className="text-fdr-red" />The mentor will design this in create mode</div>
              <p className="whitespace-pre-wrap text-[13px] text-ink-700">“{prompt.trim()}”</p>
              <p className="mt-2 text-[12px] text-ink-500">It picks a drivetrain, mechanisms and electronics, then checks every rule. If it can’t, you’ll start from Competition Base.</p>
            </div>
          ) : loadingPreview ? (
            <div className="flex items-center gap-2 py-6 text-[13px] text-ink-500"><Spinner />Generating the model and checking rules…</div>
          ) : previewErr ? (
            <div className="flex gap-2 rounded-[8px] border border-[#F3C2C2] bg-[#FFF5F5] p-3 text-[13px] text-fdr-red"><XCircle size={18} className="shrink-0" />{previewErr}</div>
          ) : preview && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {preview.metrics.map(([k, v]) => <div key={k} className="rounded-[8px] border border-line px-3 py-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{k}</div><div className="tabular text-[14px] font-bold text-ink-900">{v}</div></div>)}
              </div>
              {preview.subsystems.length > 0 && <div className="text-[12.5px] text-ink-500">Mechanisms: <span className="font-medium text-ink-800">{preview.subsystems.join(', ')}</span></div>}
              <div>
                <div className="label mb-1.5">Rule check preview</div>
                <ul className="grid gap-1">
                  {preview.checks.filter((c) => c.severity !== 'info' || !c.pass).slice(0, 10).map((c) => (
                    <li key={c.id} className="flex items-start gap-2 text-[13px]">
                      {c.pass ? <CheckCircle size={17} weight="fill" className="mt-px shrink-0 text-ok" /> : c.severity === 'error' ? <XCircle size={17} weight="fill" className="mt-px shrink-0 text-fdr-red" /> : c.severity === 'warning' ? <Warning size={17} weight="fill" className="mt-px shrink-0 text-warn" /> : <Info size={17} className="mt-px shrink-0 text-ink-400" />}
                      <span><span className="font-medium text-ink-900">{c.title}</span>{!c.pass && <span className="text-ink-500"> — {c.detail}</span>}{c.ruleRef && <span className="ml-1 font-mono text-[11px] text-ink-400">{c.ruleRef}</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {preview.notes.length > 0 && <div className="text-[12px] text-ink-500">Adjusted on import: {preview.notes.slice(0, 3).join(' · ')}</div>}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
