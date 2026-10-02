'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { House, Cube, Printer, GearSix, Code, UsersThree, List, X, Trophy, BookOpen } from '@phosphor-icons/react';
import { LogoB } from '../brand/Brand';
import { BrainPill, NotificationBell, AvatarMenu, isActive } from './HeaderItems';
import { MobileTabBar } from './MobileTabBar';

const TABS = [
  { href: '/', label: 'Dashboard', Icon: House, x: 279, w: 125 },
  { href: '/builds', label: 'Builds', Icon: Cube, x: 433, w: 64 },
  { href: '/printer', label: '3D Printer', Icon: Printer, x: 541, w: 87 },
  { href: '/parts', label: 'Parts', Icon: GearSix, x: 675, w: 57 },
  { href: '/code', label: 'VEX Code', Icon: Code, x: 778, w: 88 },
  { href: '/team', label: 'Team', Icon: UsersThree, x: 912, w: 61 },
];

export function ChromeB({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-screen bg-page-b">
      <header className="sticky top-0 z-30 h-[62px] bg-white shadow-[0_2px_14px_rgb(16_24_40/.06)]">
        <div className="relative mx-auto h-full max-w-[1672px]">
          <button aria-label="Open menu" onClick={() => setMenu(true)} className="absolute left-3 top-[15px] rounded-md p-1.5 text-ink-900 hover:bg-black/5 md:hidden"><List size={24} /></button>
          <Link href="/" aria-label="FDRHS Robotics — Dashboard" className="absolute left-[52px] top-[6px] md:left-[40px]"><LogoB /></Link>
          {/* ≥1440: measured tab positions; 1024–1439: icons + short labels; <1024: hamburger */}
          <nav aria-label="Sections" className="absolute left-0 top-0 hidden h-[62px] w-full wide:block">
            {TABS.map(({ href, label, Icon, x, w }) => {
              const active = isActive(pathname, href);
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                  className={`absolute top-0 flex h-[62px] items-center justify-center gap-2 whitespace-nowrap text-[14px] font-medium ${active ? 'border-b-4 border-fdr-red bg-[#F2F4F3] pt-1 text-fdr-red shadow-[0_6px_10px_-6px_rgb(200_6_28/.35)]' : 'text-ink-900 hover:text-fdr-red'}`}
                  style={{ left: active ? x : x - 6, width: active ? w : w + 12 }}>
                  <Icon size={18} weight={active && href === '/' ? 'fill' : 'regular'} />{label}
                </Link>
              );
            })}
          </nav>
          <nav aria-label="Sections" className="absolute left-[262px] top-0 hidden h-[62px] items-stretch md:max-wide:flex">
            {TABS.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-medium lg:px-3.5 ${active ? 'border-b-4 border-fdr-red bg-[#F2F4F3] pt-1 text-fdr-red' : 'text-ink-900 hover:text-fdr-red'}`}>
                  <Icon size={18} weight={active && href === '/' ? 'fill' : 'regular'} /><span className="hidden lg:inline">{label === '3D Printer' ? 'Printer' : label === 'VEX Code' ? 'Code' : label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="absolute right-3 top-[11px] flex items-center gap-2 sm:right-[48px] sm:gap-5">
            <div className="hidden xl:block"><BrainPill variant="b" /></div>
            <span className="hidden h-[26px] w-px bg-[#E3E5E8] xl:block" />
            <NotificationBell variant="b" />
            <AvatarMenu variant="b" />
          </div>
        </div>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenu(false)} />
          <div className="absolute inset-y-0 left-0 w-[270px] bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between"><LogoB /><button aria-label="Close menu" onClick={() => setMenu(false)} className="rounded p-1 hover:bg-black/5"><X size={20} /></button></div>
            <nav className="flex flex-col gap-1">
              {[...TABS, { href: '/competitions', label: 'Competitions', Icon: Trophy }, { href: '/resources', label: 'Resources', Icon: BookOpen }, { href: '/settings', label: 'Settings', Icon: GearSix }].map(({ href, label, Icon }) => (
                <Link key={href} href={href} onClick={() => setMenu(false)} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium ${isActive(pathname, href) ? 'bg-fdr-red text-white' : 'text-ink-900 hover:bg-[#F3F4F6]'}`}><Icon size={18} />{label}</Link>
              ))}
            </nav>
            <div className="mt-4"><BrainPill variant="b" /></div>
          </div>
        </div>
      )}
      <main className="pb-24 md:pb-8">{children}</main>
      <MobileTabBar />
    </div>
  );
}
