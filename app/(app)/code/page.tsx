'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Code } from '@phosphor-icons/react';
import { api } from '@/lib/client/api';
import { useBuilds } from '@/components/mentor/MentorDrawer';
import { CodeIDE } from '@/components/code/CodeIDE';
import { EmptyState, Spinner } from '@/components/ui/bits';

function CodeInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const builds = useBuilds();
  const fileId = sp.get('file');
  // a ?file= link (from activity / dashboard) tells us which build it belongs to
  const owner = useQuery({ queryKey: ['code-file-build', fileId], queryFn: () => api.get<{ buildId: string }>(`/api/code/files/${fileId}/build`), enabled: !!fileId && !sp.get('build') });
  const [buildId, setBuildId] = useState<string | null>(sp.get('build'));
  useEffect(() => {
    if (buildId) return;
    if (owner.data?.buildId) setBuildId(owner.data.buildId);
    else if (!fileId || owner.isError) { const b = builds.data?.builds.find((x) => x.isTeamActive) ?? builds.data?.builds[0]; if (b) setBuildId(b.id); }
  }, [buildId, owner.data, owner.isError, fileId, builds.data]);
  const list = builds.data?.builds ?? [];
  return (
    <div className="flex h-[calc(100vh-62px)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2">
        <h1 className="font-display-b text-[20px] text-ink-950">VEX Code</h1>
        <select aria-label="Build" className="input h-8 w-auto py-0 text-[13px]" value={buildId ?? ''} onChange={(e) => { setBuildId(e.target.value); router.replace(`/code?build=${e.target.value}`); }}>
          {list.map((b) => <option key={b.id} value={b.id}>{b.name}{b.isTeamActive ? ' (Active)' : ''}</option>)}
        </select>
        <span className="hidden text-[12px] text-ink-500 md:inline">Compile checks your code against the VEX V5 C++ API. Download the project to run it in VEXcode V5.</span>
      </div>
      <div className="min-h-0 flex-1">
        {buildId ? <CodeIDE key={buildId} buildId={buildId} /> : builds.isLoading || owner.isLoading ? <div className="flex h-full items-center justify-center"><Spinner /></div> : <EmptyState icon={<Code size={36} />} text="Create a build first — its robot-config and main.cpp are generated for you." />}
      </div>
    </div>
  );
}

export default function CodePage() {
  return <Suspense><CodeInner /></Suspense>;
}
