'use client';
import { BASE, withBase } from './base';
// Small fetch helpers for the browser. Errors carry the server's friendly message.
export class ClientError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) { super(message); }
}

async function handle<T>(r: Response): Promise<T> {
  const ct = r.headers.get('content-type') ?? '';
  const data = ct.includes('application/json') ? await r.json() : await r.text();
  if (r.status === 413) throw new ClientError(413, 'That file is too big for this server. On the free hosting plan, uploads can be up to 4 MB.');
  if (!r.ok) {
    const e = (data as { error?: { message?: string; code?: string; details?: unknown } })?.error;
    if (r.status === 401 && typeof window !== 'undefined' && !location.pathname.startsWith(`${BASE}/login`)) location.href = `${BASE}/login?next=${encodeURIComponent(location.pathname)}`;
    throw new ClientError(r.status, e?.message ?? `Request failed (${r.status})`, e?.code, e?.details);
  }
  return data as T;
}

export const api = {
  get: <T = unknown>(url: string) => fetch(withBase(url), { cache: 'no-store' }).then((r) => handle<T>(r)),
  post: <T = unknown>(url: string, body?: unknown, signal?: AbortSignal) => fetch(withBase(url), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), signal }).then((r) => handle<T>(r)),
  patch: <T = unknown>(url: string, body?: unknown) => fetch(withBase(url), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => handle<T>(r)),
  put: <T = unknown>(url: string, body?: unknown) => fetch(withBase(url), { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) }).then((r) => handle<T>(r)),
  del: <T = unknown>(url: string) => fetch(withBase(url), { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: '{}' }).then((r) => handle<T>(r)),
  upload: <T = unknown>(url: string, form: FormData) => fetch(withBase(url), { method: 'POST', body: form }).then((r) => handle<T>(r)),
};

export function download(url: string, filename?: string) {
  const a = document.createElement('a');
  a.href = withBase(url);
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
