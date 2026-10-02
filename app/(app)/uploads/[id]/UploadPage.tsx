'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CaretLeft, DownloadSimple, Printer } from '@phosphor-icons/react';
import { api, download } from '@/lib/client/api';
import { useUI } from '@/lib/client/stores';
import { timeAgo } from '@/lib/format';
import { Badge, Page, Skeleton, Spinner } from '@/components/ui/bits';
import { BASE, useSegment } from '@/lib/client/base';

const MeshViewer = dynamic(() => import('@/components/viewer3d/MeshViewer'), { ssr: false, loading: () => <div className="flex h-full items-center justify-center bg-[#F4F6F8]"><Spinner /></div> });
interface Up { id: string; filename: string; title: string | null; category: string | null; kind: string; size: number; ownerName: string; createdAt: number }

export function UploadPage() {
  const id = useSegment(1);
  const openSend = useUI((s) => s.openSendToPrinter);
  const q = useQuery({ queryKey: ['upload', id], queryFn: () => api.get<{ upload: Up }>(`/api/uploads/${id}`) });
  const u = q.data?.upload;
  const mesh = useQuery({ queryKey: ['upload-mesh', id], queryFn: () => api.get<{ positions: number[]; indices: number[]; bbox: { min: number[]; max: number[] }; volumeMm3: number }>(`/api/uploads/${id}/mesh`), enabled: u?.kind === 'stl' });
  if (q.isError) return <Page><p className="text-[14px] text-ink-500">That file doesn’t exist anymore. <Link href="/resources" className="font-semibold text-fdr-red underline">Resources</Link></p></Page>;
  return (
    <Page>
      <Link href="/team?tab=activity" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500 hover:text-ink-900"><CaretLeft size={14} />Back</Link>
      {!u ? <Skeleton className="h-[480px] rounded-[10px]" /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
          <div className="card h-[min(70vh,640px)] overflow-hidden rounded-[10px]">
            {u.kind === 'stl' ? (mesh.data ? <MeshViewer positions={mesh.data.positions} indices={mesh.data.indices} color="gray" className="h-full w-full" /> : <div className="flex h-full items-center justify-center bg-[#F4F6F8]"><Spinner /></div>)
              : u.kind === 'pdf' || u.kind === 'text' ? <iframe title={u.filename} src={`${BASE}/api/uploads/${u.id}/file?inline=1`} className="h-full w-full" />
              : u.kind === 'image' ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={`${BASE}/api/uploads/${u.id}/file?inline=1`} alt={u.filename} className="h-full w-full object-contain" />
              : <div className="flex h-full items-center justify-center text-[13px] text-ink-500">No preview for this file type — download it to open it.</div>}
          </div>
          <aside className="card h-fit rounded-[10px] p-4">
            <h1 className="break-words text-[18px] font-bold text-ink-900">{u.title ?? u.filename}</h1>
            <div className="mt-1 text-[12.5px] text-ink-500">{u.filename}</div>
            <div className="mt-3 flex flex-wrap gap-1.5"><Badge tone="grey">{u.kind.toUpperCase()}</Badge>{u.category && <Badge tone="blue">{u.category}</Badge>}</div>
            <dl className="mt-4 grid gap-1.5 text-[12.5px]">
              <div className="flex justify-between"><dt className="text-ink-500">Uploaded by</dt><dd className="font-medium">{u.ownerName}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">When</dt><dd>{timeAgo(u.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Size</dt><dd>{Math.max(1, Math.round(u.size / 1024))} KB</dd></div>
              {mesh.data && <div className="flex justify-between"><dt className="text-ink-500">Dimensions</dt><dd className="tabular">{[0, 1, 2].map((k) => Math.round(mesh.data!.bbox.max[k] - mesh.data!.bbox.min[k])).join(' × ')} mm</dd></div>}
            </dl>
            <div className="mt-4 grid gap-2">
              <button className="btn btn-primary h-9" onClick={() => download(`/api/uploads/${u.id}/file`)}><DownloadSimple size={16} />Download</button>
              {u.kind === 'stl' && <button className="btn btn-outline h-9" onClick={() => openSend({ uploadId: u.id })}><Printer size={16} />Send to Printer</button>}
            </div>
          </aside>
        </div>
      )}
    </Page>
  );
}
