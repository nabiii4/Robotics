// time + unit formatting shared by client and server
const rtf = typeof Intl !== 'undefined' ? new Intl.RelativeTimeFormat('en', { numeric: 'always' }) : null;

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.round((now - ms) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return rtf ? rtf.format(-m, 'minute') : `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return rtf ? rtf.format(-h, 'hour') : `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return rtf ? rtf.format(-d, 'day') : `${d} days ago`;
  return new Date(ms).toLocaleDateString();
}
/** compact: "2 min ago", "1 hr ago" (Layout B) */
export function agoShort(ms: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}
/** Layout A: "2 min", "1 h" */
export function agoA(ms: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
export function captionAgo(ms: number, now = Date.now()): string {
  const m = Math.max(0, Math.round((now - ms) / 60000));
  if (m < 60) return `${Math.max(1, m)}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
/** "1h 12m" / "38m" */
export function hm(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}
/** "32 min left" / "1 hr 12 min left" */
export function leftText(sec: number): string {
  const m = Math.max(0, Math.round(sec / 60));
  const h = Math.floor(m / 60);
  return h ? `${h} hr ${m % 60} min left` : `${m} min left`;
}
export function monthYear(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).replace(',', '');
}
export function daysUntil(dateStr: string, now = Date.now()): number {
  return Math.ceil((new Date(`${dateStr}T00:00:00`).getTime() - now) / 86400000);
}
export const inch = (n: number, d = 1) => `${n.toFixed(d)} in`;
