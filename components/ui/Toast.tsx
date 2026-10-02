'use client';
import { create } from 'zustand';
import { useEffect } from 'react';
import { X, CheckCircle, WarningCircle, Info } from '@phosphor-icons/react';

type Tone = 'ok' | 'error' | 'info';
interface ToastItem { id: number; title: string; body?: string; tone: Tone; action?: { label: string; onClick: () => void }; ms: number }
interface S { items: ToastItem[]; push: (t: Omit<ToastItem, 'id' | 'ms'> & { ms?: number }) => void; remove: (id: number) => void }
let n = 0;
export const useToasts = create<S>((set) => ({
  items: [],
  push: (t) => set((s) => ({ items: [...s.items.slice(-3), { ...t, ms: t.ms ?? 5000, id: ++n }] })),
  remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));
export const toast = {
  ok: (title: string, body?: string, action?: ToastItem['action']) => useToasts.getState().push({ title, body, tone: 'ok', action }),
  error: (title: string, body?: string) => useToasts.getState().push({ title, body, tone: 'error', ms: 7000 }),
  info: (title: string, body?: string, action?: ToastItem['action']) => useToasts.getState().push({ title, body, tone: 'info', action }),
};

function Item({ t }: { t: ToastItem }) {
  const remove = useToasts((s) => s.remove);
  useEffect(() => { const h = setTimeout(() => remove(t.id), t.ms); return () => clearTimeout(h); }, [t.id, t.ms, remove]);
  const Icon = t.tone === 'ok' ? CheckCircle : t.tone === 'error' ? WarningCircle : Info;
  const color = t.tone === 'ok' ? 'text-ok' : t.tone === 'error' ? 'text-fdr-red' : 'text-ink-700';
  return (
    <div role="status" className="pointer-events-auto flex w-[360px] max-w-[calc(100vw-32px)] items-start gap-3 rounded-[10px] border border-line bg-white p-3 shadow-[0_8px_24px_rgb(16_24_40/.14)]">
      <Icon size={20} weight="fill" className={`${color} mt-0.5 shrink-0`} />
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-ink-900">{t.title}</div>
        {t.body && <div className="mt-0.5 text-[12.5px] text-ink-500">{t.body}</div>}
        {t.action && <button className="mt-1.5 text-[12.5px] font-semibold text-fdr-red hover:underline" onClick={() => { t.action!.onClick(); remove(t.id); }}>{t.action.label}</button>}
      </div>
      <button aria-label="Dismiss" onClick={() => remove(t.id)} className="text-ink-400 hover:text-ink-900"><X size={16} /></button>
    </div>
  );
}

export function Toaster() {
  const items = useToasts((s) => s.items);
  return <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">{items.map((t) => <Item key={t.id} t={t} />)}</div>;
}
