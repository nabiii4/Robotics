'use client';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { ArrowsOutCardinal, MagnifyingGlassPlus, MagnifyingGlassMinus, FrameCorners, Cube } from '@phosphor-icons/react';
import { api } from '@/lib/client/api';
import type { ViewerApi, Preset } from './RobotCanvas';
import type { PartInstance } from '@/lib/robot/generator/core';
import type { Metrics } from '@/lib/robot/metrics';
import type { RuleCheck } from '@/lib/robot/rules';
import type { Device } from '@/lib/robot/ports';
import type { BomRow } from '@/lib/robot/bom';
import type { RobotSpec } from '@/lib/robot/spec';
import type { AssemblyStep, Collision } from '@/lib/robot/generator/core';
import { Tip } from '../ui/Tip';

export type { ViewerApi, Preset };

export function ViewerLoading({ className = '' }: { className?: string }) {
  return (
    <div className={`viewer-bg relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}>
      <div className="drift-grid absolute inset-0" />
      <span className="relative text-[11px] font-semibold tracking-[.3em] text-white/60">LOADING MODEL…</span>
    </div>
  );
}

export const LazyRobotCanvas = dynamic(() => import('./RobotCanvas'), { ssr: false, loading: () => <ViewerLoading /> });

export interface Derived {
  build: { id: string; name: string; tagline: string | null; status: string; drawingPrefix: string; program: string; isTeamActive: boolean; visibility: string; ownerId: string; currentVersionId: string | null };
  version: number; versionId: string; isCurrent: boolean; createdAt: number; source: string;
  spec: RobotSpec; parts: PartInstance[]; bbox: { min: [number, number, number]; max: [number, number, number] };
  metrics: Metrics; ruleChecks: RuleCheck[]; devices: Device[]; bom: BomRow[]; steps: AssemblyStep[]; collisions: Collision[];
  normalizeReport: { path: string; from: unknown; to: unknown; reason: string }[]; statuses: Record<string, string>;
  robotConfig: { cpp: string; h: string };
}

export function useDerived(buildId: string | null | undefined, versionId?: string | null) {
  return useQuery({
    queryKey: ['derived', buildId, versionId ?? 'current'],
    queryFn: () => api.get<Derived>(`/api/builds/${buildId}/derived${versionId ? `?version=${versionId}` : ''}`),
    enabled: !!buildId, staleTime: 30_000, placeholderData: (prev) => prev,
  });
}

const TB = 'btn btn-dark h-[38px] w-[38px] rounded-[6px] p-0';
export function ViewerToolbar({ api: getApi, pan, setPan, className = '' }: { api: () => ViewerApi | null; pan: boolean; setPan: (p: boolean) => void; className?: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex flex-col gap-[5px]">
        <Tip label={pan ? 'Pan mode (drag to move)' : 'Orbit mode (drag to rotate)'} side="right"><button aria-label="Pan" aria-pressed={pan} className={TB} onClick={() => { setPan(!pan); getApi()?.setPan(!pan); }}><ArrowsOutCardinal size={18} /></button></Tip>
        <Tip label="Zoom in" side="right"><button aria-label="Zoom in" className={TB} onClick={() => getApi()?.zoom(1.25)}><MagnifyingGlassPlus size={18} /></button></Tip>
        <Tip label="Zoom out" side="right"><button aria-label="Zoom out" className={TB} onClick={() => getApi()?.zoom(0.8)}><MagnifyingGlassMinus size={18} /></button></Tip>
        <Tip label="Fit to view" side="right"><button aria-label="Fit to view" className={TB} onClick={() => getApi()?.fit()}><FrameCorners size={18} /></button></Tip>
      </div>
      <Tip label="Reset view" side="right"><button aria-label="Reset view" className={`${TB} mt-[9px]`} onClick={() => getApi()?.reset()}><Cube size={18} /></button></Tip>
    </div>
  );
}

export function ViewPresets({ value, onChange, className = '' }: { value: Preset; onChange: (p: Preset) => void; className?: string }) {
  const items: [Preset, string, number][] = [['iso', 'Isometric', 88], ['front', 'Front', 64], ['side', 'Side', 52], ['top', 'Top', 73]];
  return (
    <div className={`flex gap-[10px] ${className}`} role="group" aria-label="View presets">
      {items.map(([p, l, w]) => <button key={p} aria-pressed={value === p} onClick={() => onChange(p)} className="btn btn-dark h-[35px] rounded-[5px] text-[12.5px] font-medium" style={{ width: w }}>{l}</button>)}
    </div>
  );
}
