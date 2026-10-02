'use client';
import { Suspense } from 'react';
import { Workspace } from '@/components/builds/Workspace';
import { useSegment } from '@/lib/client/base';

export function BuildPage() {
  const id = useSegment(1);
  return <Suspense><Workspace key={id} id={id} /></Suspense>;
}
