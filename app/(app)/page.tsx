'use client';
import { useMe } from '@/components/shell/AppShell';
import { DashboardA } from '@/components/dashboard/DashboardA';
import { DashboardB } from '@/components/dashboard/DashboardB';

export default function DashboardPage() {
  const { layout } = useMe();
  return layout === 'a' ? <DashboardA /> : <DashboardB />;
}
