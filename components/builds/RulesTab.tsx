'use client';
import { CheckCircle, Info, Sparkle, Warning, XCircle } from '@phosphor-icons/react';
import type { Derived } from '../viewer3d/Viewer';

const ORDER = { error: 0, warning: 1, info: 2 } as const;

export function RulesTab({ d, askMentor }: { d: Derived; askMentor: (text: string) => void }) {
  const checks = [...d.ruleChecks].sort((a, b) => Number(a.pass) - Number(b.pass) || ORDER[a.severity] - ORDER[b.severity]);
  const fails = checks.filter((c) => !c.pass && c.severity === 'error').length;
  const warns = checks.filter((c) => !c.pass && c.severity === 'warning').length;
  const passes = checks.filter((c) => c.pass).length;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-3 sm:max-w-[560px]">
        <div className="card rounded-[10px] px-4 py-3"><div className="text-[12px] font-semibold text-ink-500">Passing</div><div className="tabular text-[22px] font-extrabold text-ok">{passes}</div></div>
        <div className="card rounded-[10px] px-4 py-3"><div className="text-[12px] font-semibold text-ink-500">Warnings</div><div className="tabular text-[22px] font-extrabold text-[#B98900]">{warns}</div></div>
        <div className="card rounded-[10px] px-4 py-3"><div className="text-[12px] font-semibold text-ink-500">Failing</div><div className={`tabular text-[22px] font-extrabold ${fails ? 'text-fdr-red' : 'text-ink-400'}`}>{fails}</div></div>
      </div>
      {!!d.normalizeReport.length && (
        <div className="rounded-[8px] border border-line bg-[#F8F9FA] px-4 py-3 text-[12.5px] text-ink-600">
          <b className="text-ink-800">Auto-corrected in this version:</b> {d.normalizeReport.map((n) => n.reason).join(' · ')}
        </div>
      )}
      <ul className="card divide-y divide-line rounded-[10px]">
        {checks.map((c) => (
          <li key={c.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            {c.pass ? <CheckCircle size={20} weight="fill" className="shrink-0 text-ok" /> : c.severity === 'error' ? <XCircle size={20} weight="fill" className="shrink-0 text-fdr-red" /> : c.severity === 'warning' ? <Warning size={20} weight="fill" className="shrink-0 text-warn" /> : <Info size={20} className="shrink-0 text-ink-400" />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink-900">{c.title}{c.ruleRef && <span className="font-mono text-[11.5px] font-medium text-ink-400">{c.ruleRef}</span>}</div>
              <p className="text-[13px] text-ink-600">{c.detail}</p>
              {!c.pass && c.fixHint && <p className="mt-0.5 text-[12.5px] text-ink-500">Fix: {c.fixHint}</p>}
            </div>
            {!c.pass && c.severity !== 'info' && (
              <button className="btn btn-outline h-8 shrink-0 text-[12.5px]" onClick={() => askMentor(`Our robot fails the rule check "${c.title}"${c.ruleRef ? ` (${c.ruleRef})` : ''}: ${c.detail} Please change the design so it passes, and explain what you changed.`)}>
                <Sparkle size={14} className="text-fdr-red" />Ask Mentor to fix
              </button>
            )}
          </li>
        ))}
      </ul>
      {!!d.collisions.length && (
        <section className="card rounded-[10px] p-4">
          <h3 className="mb-2 text-[14px] font-bold text-ink-900">Collisions in the model</h3>
          <ul className="grid gap-1 text-[12.5px] text-ink-700">{d.collisions.slice(0, 20).map((c, i) => <li key={i}>• {c.message}</li>)}</ul>
        </section>
      )}
    </div>
  );
}
