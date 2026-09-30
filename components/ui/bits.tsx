'use client';
import { CheckCircle, Circle } from '@phosphor-icons/react';

export function Avatar({ user, size = 30, variant = 'b', className = '' }: { user: { displayName?: string; name?: string; avatarText?: string | null; avatarColor?: string; color?: string; initial?: string }; size?: number; variant?: 'a' | 'b'; className?: string }) {
  const text = user.avatarText ?? user.initial ?? (user.displayName ?? user.name ?? '?').charAt(0).toUpperCase();
  const color = user.avatarColor ?? user.color ?? '#171D22';
  const neutral = variant === 'a';
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
      style={{ width: size, height: size, background: neutral ? '#E3E5E8' : color, color: neutral ? '#121418' : '#fff', fontSize: Math.round(size * 0.43) }}>
      {text.slice(0, 2)}
    </span>
  );
}

export function Progress({ value, color = '#C8061C', height = 5, className = '' }: { value: number; color?: string; height?: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[3px] bg-track ${className}`} style={{ height }} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-[3px] transition-[width] duration-[600ms]" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} />
    </div>
  );
}

export function Donut({ value, size = 101, stroke = 10, color = '#CB061B', children }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E0E3E7" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${c * Math.max(0, Math.min(1, value))} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .6s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

export function StatusDot({ state, size = 16 }: { state: 'complete' | 'in_progress' | 'planned' | 'done' | 'doing' | 'todo'; size?: number }) {
  if (state === 'complete' || state === 'done') return <CheckCircle size={size} weight="fill" className="shrink-0 text-ok" />;
  if (state === 'in_progress' || state === 'doing') return <span className="flex shrink-0 items-center justify-center rounded-full bg-warn" style={{ width: size, height: size }}><span className="block h-[5px] w-[5px] rounded-full bg-ink-900" /></span>;
  return <span className="block shrink-0 rounded-full border-[1.5px] border-ink-300" style={{ width: size - 3, height: size - 3 }} />;
}
export const EmptyCircle = ({ size = 15 }: { size?: number }) => <Circle size={size} className="text-[#75767D]" />;

export function Badge({ children, tone = 'red', className = '' }: { children: React.ReactNode; tone?: 'red' | 'green' | 'grey' | 'blue' | 'purple' | 'amber'; className?: string }) {
  const t = {
    red: 'bg-fdr-red-50 text-fdr-red border-fdr-red-100', green: 'bg-ok-50 text-ok-ink border-ok-200', grey: 'bg-[#F1F3F5] text-ink-600 border-line',
    blue: 'bg-[#E8F1FC] text-[#1B5FB5] border-[#C8DBF3]', purple: 'bg-[#F1ECFB] text-[#5A34A8] border-[#DCD0F3]', amber: 'bg-[#FFF6D6] text-[#8A6400] border-[#F3E2A5]',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-[5px] border px-2 py-0.5 text-[11.5px] font-semibold ${t} ${className}`}>{children}</span>;
}

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function EmptyState({ icon, text, action }: { icon: React.ReactNode; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
      <div className="text-ink-300">{icon}</div>
      <p className="text-[13.5px] text-ink-500">{text}</p>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display-b text-[32px] leading-[1.1] text-ink-950">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', title, icon, action, padded = true }: { children?: React.ReactNode; className?: string; title?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; padded?: boolean }) {
  return (
    <section className={`card rounded-[12px] ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <h2 className="flex items-center gap-2.5 text-[15px] font-bold text-ink-900">{icon && <span className="text-fdr-red-bright">{icon}</span>}{title}</h2>
          {action}
        </div>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className = '' }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string }) {
  return (
    <div className={`inline-flex rounded-[7px] border border-line bg-white p-0.5 ${className}`} role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`rounded-[5px] px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${value === o.value ? 'bg-fdr-red text-white' : 'text-ink-700 hover:bg-[#F6F7F9]'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <span aria-hidden className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent" style={{ width: size, height: size }} />;
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-ink-400">{hint}</span>}
    </label>
  );
}
