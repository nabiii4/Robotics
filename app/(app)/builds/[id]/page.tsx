'use client';
import { Suspense, use } from 'react';
import { Workspace } from '@/components/builds/Workspace';

export default function BuildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Suspense><Workspace id={id} /></Suspense>;
}
