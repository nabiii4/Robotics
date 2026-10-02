'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowSquareOut, BookOpen, DownloadSimple, FileArrowUp, FilePdf, FileText, Image as ImageIcon, MagnifyingGlass, PencilSimple, Plus, Sparkle, Trash, Cube, X } from '@phosphor-icons/react';
import { api, ClientError, download } from '@/lib/client/api';
import { timeAgo } from '@/lib/format';
import { useMe } from '@/components/shell/AppShell';
import { Badge, EmptyState, Field, Page, PageHeader, Skeleton, Spinner } from '@/components/ui/bits';
import { Dialog } from '@/components/ui/Dialog';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/Toast';
import { BASE } from '@/lib/client/base';

interface Up { id: string; filename: string; title: string | null; category: string | null; kind: string; mime: string; size: number; useForAi: boolean; chunks: number; ownerId: string; ownerName: string; createdAt: number }
const DOC_CATS = ['Game Manual', 'Rules Q&A', 'Notebook', 'Design', 'Programming', 'Strategy', 'Photos', 'Other'];
const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function LinksEditor({ open, onClose, links }: { open: boolean; onClose: () => void; links: { title: string; url: string; description: string }[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState(links);
  const save = async () => { try { await api.put('/api/resources/links', { links: rows.filter((r) => r.title && r.url) }); qc.invalidateQueries({ queryKey: ['resource-links'] }); toast.ok('Links saved'); onClose(); } catch (e) { toast.error('Could not save', (e as ClientError).message); } };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="Edit curated links" width={720} footer={<><button className="btn btn-outline" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      <div className="grid gap-3">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_auto] gap-2">
            <input className="input" placeholder="Title" value={r.title} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} />
            <input className="input" placeholder="https://…" value={r.url} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
            <button aria-label="Remove link" className="btn btn-outline h-[38px] w-[38px] p-0" onClick={() => setRows(rows.filter((_, k) => k !== i))}><X size={15} /></button>
            <input className="input col-span-3" placeholder="One-line description" value={r.description} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)))} />
          </div>
        ))}
        <button className="btn btn-outline h-9 w-fit" onClick={() => setRows([...rows, { title: '', url: '', description: '' }])}><Plus size={15} />Add link</button>
      </div>
    </Dialog>
  );
}

export default function ResourcesPage() {
  const { me } = useMe();
  const qc = useQueryClient();
  const links = useQuery({ queryKey: ['resource-links'], queryFn: () => api.get<{ links: { title: string; url: string; description: string }[] }>('/api/resources/links') });
  const ups = useQuery({ queryKey: ['uploads', 'docs'], queryFn: () => api.get<{ uploads: Up[] }>('/api/uploads?docs=1') });
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const [preview, setPreview] = useState<Up | null>(null);
  const [uploading, setUploading] = useState<{ file: File; title: string; category: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editLinks, setEditLinks] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const captain = me.role !== 'member';
  const docs = (ups.data?.uploads ?? []).filter((u) => (!cat || u.category === cat) && (!search || `${u.title ?? ''} ${u.filename} ${u.category ?? ''}`.toLowerCase().includes(search.toLowerCase())));
  const refresh = () => { qc.invalidateQueries({ queryKey: ['uploads'] }); };
  const doUpload = async () => {
    if (!uploading) return;
    setBusy('upload');
    try { const fd = new FormData(); fd.append('file', uploading.file); fd.append('title', uploading.title); fd.append('category', uploading.category); await api.upload('/api/uploads', fd); refresh(); setUploading(null); toast.ok('Uploaded'); }
    catch (e) { toast.error('Upload failed', (e as ClientError).message); } finally { setBusy(null); }
  };
  const toggleAi = async (u: Up, on: boolean) => {
    setBusy(u.id);
    try { const r = await api.patch<{ chunks?: number }>(`/api/uploads/${u.id}`, { useForAi: on }); refresh(); toast.ok(on ? `Indexed for the mentor (${r.chunks} sections)` : 'Removed from the mentor’s knowledge'); }
    catch (e) { toast.error('Could not change that', (e as ClientError).message); } finally { setBusy(null); }
  };
  const del = async (u: Up) => { if (!confirm(`Delete ${u.title ?? u.filename}?`)) return; try { await api.del(`/api/uploads/${u.id}`); refresh(); toast.ok('Deleted'); } catch (e) { toast.error('Could not delete', (e as ClientError).message); } };
  const Icon = ({ k }: { k: string }) => (k === 'pdf' ? <FilePdf size={22} className="text-fdr-red" /> : k === 'image' ? <ImageIcon size={22} className="text-[#1F6FD1]" /> : k === 'stl' ? <Cube size={22} className="text-ink-700" /> : <FileText size={22} className="text-ink-500" />);
  return (
    <Page>
      <PageHeader title="Resources" subtitle="Official links and the team's own documents. Turn on “Use for AI” to let the mentor quote a document." actions={<button className="btn btn-primary h-10 px-4" onClick={() => file.current?.click()}><FileArrowUp size={16} />Upload document</button>} />
      <input ref={file} type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploading({ file: f, title: f.name.replace(/\.[^.]+$/, ''), category: /manual/i.test(f.name) ? 'Game Manual' : 'Other' }); e.target.value = ''; }} />
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between"><h2 className="text-[14px] font-bold text-ink-900">Official links</h2>{captain && links.data && <button className="btn btn-ghost h-8 text-[12.5px]" onClick={() => setEditLinks(true)}><PencilSimple size={14} />Edit</button>}</div>
        {links.isLoading ? <Skeleton className="h-28 rounded-[10px]" /> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {links.data?.links.map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="card group flex gap-3 rounded-[10px] p-4 hover:shadow-[0_6px_18px_rgb(16_24_40/.1)]">
                <BookOpen size={22} className="mt-0.5 shrink-0 text-fdr-red" />
                <span className="min-w-0"><span className="flex items-center gap-1 text-[14px] font-bold text-ink-900 group-hover:text-fdr-red">{l.title}<ArrowSquareOut size={13} /></span><span className="block text-[12.5px] text-ink-500">{l.description}</span><span className="block truncate text-[11.5px] text-ink-400">{l.url.replace(/^https?:\/\//, '')}</span></span>
              </a>
            ))}
          </div>
        )}
      </section>
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-[14px] font-bold text-ink-900">Team uploads</h2>
          <select aria-label="Category" className="input h-9 w-auto" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{DOC_CATS.map((c) => <option key={c}>{c}</option>)}</select>
          <label className="relative ml-auto w-full sm:w-64"><MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><input className="input h-9 pl-9" placeholder="Search documents" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        </div>
        {ups.isLoading ? <Skeleton className="h-40 rounded-[10px]" /> : !docs.length ? <div className="card rounded-[10px] py-8"><EmptyState icon={<FileText size={36} />} text="No documents yet. Upload the Game Manual PDF and switch on “Use for AI” so the mentor can cite the rules." /></div> : (
          <ul className="card divide-y divide-line rounded-[10px]">
            {docs.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Icon k={u.kind} />
                <button className="min-w-0 flex-1 text-left" onClick={() => (u.kind === 'pdf' || u.kind === 'image' || u.kind === 'text' ? setPreview(u) : download(`/api/uploads/${u.id}/file`))}>
                  <span className="block truncate text-[14px] font-semibold text-ink-900 hover:text-fdr-red">{u.title ?? u.filename}</span>
                  <span className="block text-[12px] text-ink-500">{u.filename} · {kb(u.size)} · {u.ownerName} · {timeAgo(u.createdAt)}</span>
                </button>
                {u.category && <Badge tone="grey">{u.category}</Badge>}
                {(u.kind === 'pdf' || u.kind === 'text') && (
                  <label className={`flex items-center gap-2 text-[12.5px] ${captain ? 'text-ink-700' : 'text-ink-400'}`} title={captain ? undefined : 'Captains and admins choose AI documents'}>
                    {busy === u.id ? <Spinner size={14} /> : <Sparkle size={14} className={u.useForAi ? 'text-fdr-red' : 'text-ink-300'} />}Use for AI{u.useForAi && u.chunks ? <span className="text-ink-400">({u.chunks})</span> : null}
                    <Switch checked={u.useForAi} disabled={!captain || busy === u.id} onCheckedChange={(v) => toggleAi(u, v)} label={`Use ${u.title ?? u.filename} for AI`} />
                  </label>
                )}
                <button aria-label="Download" className="rounded p-1.5 text-ink-500 hover:bg-black/5" onClick={() => download(`/api/uploads/${u.id}/file`)}><DownloadSimple size={17} /></button>
                {(u.ownerId === me.id || me.role === 'admin') && <button aria-label="Delete" className="rounded p-1.5 text-ink-400 hover:bg-black/5 hover:text-fdr-red" onClick={() => del(u)}><Trash size={17} /></button>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Dialog open={!!uploading} onOpenChange={(o) => !o && setUploading(null)} title="Upload document" description={uploading ? `${uploading.file.name} · ${kb(uploading.file.size)}` : ''} width={460}
        footer={<><button className="btn btn-outline" onClick={() => setUploading(null)}>Cancel</button><button className="btn btn-primary" disabled={busy === 'upload'} onClick={doUpload}>{busy === 'upload' ? <Spinner /> : null}Upload</button></>}>
        {uploading && <div className="grid gap-3"><Field label="Title"><input className="input" maxLength={120} value={uploading.title} onChange={(e) => setUploading({ ...uploading, title: e.target.value })} /></Field><Field label="Category"><select className="input" value={uploading.category} onChange={(e) => setUploading({ ...uploading, category: e.target.value })}>{DOC_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field></div>}
      </Dialog>
      {preview && (
        <Dialog open onOpenChange={(o) => !o && setPreview(null)} title={preview.title ?? preview.filename} width={980} footer={<><button className="btn btn-outline" onClick={() => download(`/api/uploads/${preview.id}/file`)}><DownloadSimple size={15} />Download</button><Link href={`/uploads/${preview.id}`} className="btn btn-outline">Open page</Link></>}>
          {preview.kind === 'pdf' ? <iframe title={preview.filename} src={`${BASE}/api/uploads/${preview.id}/file?inline=1`} className="h-[70vh] w-full rounded border border-line" />
            : preview.kind === 'image' ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${BASE}/api/uploads/${preview.id}/file?inline=1`} alt={preview.title ?? preview.filename} className="mx-auto max-h-[70vh] rounded" />
            : <iframe title={preview.filename} src={`${BASE}/api/uploads/${preview.id}/file?inline=1`} className="h-[60vh] w-full rounded border border-line bg-white" />}
        </Dialog>
      )}
      {editLinks && links.data && <LinksEditor open onClose={() => setEditLinks(false)} links={links.data.links} />}
    </Page>
  );
}
