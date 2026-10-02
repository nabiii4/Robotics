'use client';
import Link from 'next/link';
import { Suspense } from 'react';
import { Bell, Brain, Database, Palette, Printer, Robot, ShieldCheck, Sparkle, User, UsersThree, BookOpen } from '@phosphor-icons/react';
import { useMe } from '@/components/shell/AppShell';
import { Page, PageHeader } from '@/components/ui/bits';
import { AppearanceTab, AiMemoryTab, NotificationsTab, ProfileTab, SecurityTab } from '@/components/settings/PersonalTabs';
import { AiUsageTab, DataTab, KnowledgeTab, PrintersTab, SeasonTab, TeamAdminTab } from '@/components/settings/AdminTabs';
import { useSegment } from '@/lib/client/base';

const TABS = [
  { key: 'profile', label: 'Profile', Icon: User, admin: false, C: ProfileTab },
  { key: 'appearance', label: 'Appearance', Icon: Palette, admin: false, C: AppearanceTab },
  { key: 'ai', label: 'AI Mentor & Memory', Icon: Brain, admin: false, C: AiMemoryTab },
  { key: 'notifications', label: 'Notifications', Icon: Bell, admin: false, C: NotificationsTab },
  { key: 'security', label: 'Security', Icon: ShieldCheck, admin: false, C: SecurityTab },
  { key: 'team', label: 'Team', Icon: UsersThree, admin: true, C: TeamAdminTab },
  { key: 'season', label: 'Season Rules', Icon: Robot, admin: true, C: SeasonTab },
  { key: 'printers', label: 'Printers', Icon: Printer, admin: true, C: PrintersTab },
  { key: 'ai-usage', label: 'AI & Usage', Icon: Sparkle, admin: true, C: AiUsageTab },
  { key: 'knowledge', label: 'Knowledge Base', Icon: BookOpen, admin: true, C: KnowledgeTab },
  { key: 'data', label: 'Data', Icon: Database, admin: true, C: DataTab },
] as const;

function SettingsInner({ tab }: { tab: string }) {
  const { me } = useMe();
  const isAdmin = me.role === 'admin';
  const visible = TABS.filter((t) => !t.admin || isAdmin);
  const cur = visible.find((t) => t.key === tab) ?? visible[0];
  const C = cur.C;
  return (
    <Page>
      <PageHeader title="Settings" subtitle={isAdmin ? 'Your account, plus team-wide settings for admins.' : 'Your account and preferences.'} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto lg:flex-col">
          {visible.map((t, i) => (
            <div key={t.key} className="contents">
              {t.admin && !visible[i - 1]?.admin && <div className="hidden px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-ink-400 lg:block">Admin</div>}
              <Link href={`/settings/${t.key}`} aria-current={cur.key === t.key ? 'page' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium ${cur.key === t.key ? 'bg-fdr-red text-white' : 'text-ink-700 hover:bg-[#ECEEF0]'}`}><t.Icon size={17} />{t.label}</Link>
            </div>
          ))}
        </nav>
        <div className="min-w-0"><C /></div>
      </div>
    </Page>
  );
}

export function SettingsPage() {
  const tab = useSegment(1);
  return <Suspense><SettingsInner tab={tab || 'profile'} /></Suspense>;
}
