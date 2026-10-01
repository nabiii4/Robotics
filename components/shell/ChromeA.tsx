'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { House, Cube, Printer, Package, Code, UsersThree, Trophy, BookOpen, GearSix, Command, List, X } from '@phosphor-icons/react';
import { LogoA, CougarWatermark, CougarHead } from '../brand/Brand';
import { BrainPill, NotificationBell, AvatarMenu, isActive } from './HeaderItems';
import { MobileTabBar } from './MobileTabBar';
import { Tip } from '../ui/Tip';

const SIDE = [
  { href: '/', label: 'Dashboard', Icon: House },
  { href: '/builds', label: 'Builds', Icon: Cube },
  { href: '/printer', label: '3D Printer', Icon: Printer },
  { href: '/parts', label: 'Parts & Inventory', Icon: Package },
  { href: '/code', label: 'VEX Code', Icon: Code },
  { href: '/team', label: 'Team', Icon: UsersThree },
  { href: '/competitions', label: 'Competitions', Icon: Trophy },
  { href: '/resources', label: 'Resources', Icon: BookOpen },
  { href: '/settings', label: 'Settings', Icon: GearSix },
];
const TOP = [
  { href: '/', label: 'Dashboard', Icon: House, x: 333, w: 128 },
  { href: '/builds', label: 'Builds', Icon: Command, x: 483, w: 63 },
  { href: '/printer', label: '3D Printer', Icon: Printer, x: 582, w: 87 },
  { href: '/parts', label: 'Parts', Icon: Cube, x: 705, w: 57 },
  { href: '/code', label: 'VEX Code', Icon: Code, x: 797, w: 87 },
  { href: '/team', label: 'Team', Icon: UsersThree, x: 920, w: 61 },
];
const FILLED = new Set(['/', '/team', '/competitions', '/settings']);

function SidebarNav({ pathname, rail, onNavigate }: { pathname: string; rail?: boolean; onNavigate?: () => void }) {
  return (
    <ul className={`flex flex-col gap-[5.5px] ${rail ? 'items-center px-2' : 'px-[14px]'}`}>
      {SIDE.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        const link = (
          <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined}
            className={`flex h-[42px] items-center rounded-[8px] text-[15px] font-medium transition-colors ${rail ? 'w-[48px] justify-center' : 'gap-[23px] pl-[16px]'} ${active ? 'bg-fdr-red-nav text-white' : 'text-[#E9ECEF] hover:bg-white/[.06]'}`}>
            <Icon size={22} weight={active || FILLED.has(href) ? 'fill' : 'regular'} />
            {!rail && <span className="truncate">{label}</span>}
          </Link>
        );
        return <li key={href}>{rail ? <Tip label={label} side="right">{link}</Tip> : link}</li>;
      })}
    </ul>
  );
}

function SidebarFull({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <div className="relative flex h-full flex-col bg-ink-800">
      <CougarWatermark />
      <div className="relative z-[1] px-[27px] pt-[229px] text-[12px] font-semibold leading-[19px] tracking-[.12em] text-white">FRANKLIN D. ROOSEVELT<br />HIGH SCHOOL</div>
      <nav aria-label="Main" className="relative z-[1] mt-[17px]"><SidebarNav pathname={pathname} onNavigate={onNavigate} /></nav>
      <div className="mt-auto px-[30px] pb-[38px]">
        <p className="text-[16px] italic leading-6 text-[#B1B5BB]">“Same Cougars.<br />A Brighter Tomorrow.”</p>
        <div className="mt-[21px] h-[2px] w-[28px] bg-fdr-red" />
        <div className="mt-[36px] text-[12px] font-semibold leading-[18px] tracking-[.3em] text-[#D9DCE0]">FDRHS<br />ROBOTICS <span className="text-fdr-red">{"///"}</span></div>
      </div>
    </div>
  );
}

export function ChromeA({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  return (
    <div className="min-h-screen bg-page-a">
      {/* ≥1280: full sidebar; 1024–1279: 72px icon rail; <1024: drawer */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[244px] xl:block"><SidebarFull pathname={pathname} /></aside>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col items-center bg-ink-800 pt-3 lg:flex xl:hidden">
        <Link href="/" aria-label="Dashboard" className="mb-5"><CougarHead width={50} height={46} /></Link>
        <nav aria-label="Main"><SidebarNav pathname={pathname} rail /></nav>
      </aside>
      <Link href="/" aria-label="FDRHS Robotics & Computer Science — Dashboard" className="fixed left-0 top-0 z-40 hidden h-[86px] w-[300px] rounded-br-[28px] bg-ink-800 xl:block"><LogoA /></Link>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[260px] overflow-y-auto">
            <div className="relative h-full">
              <SidebarFull pathname={pathname} onNavigate={() => setDrawer(false)} />
              <div className="absolute left-0 top-0 h-[86px] w-[260px] bg-ink-800"><div className="origin-top-left scale-[.86]"><LogoA /></div></div>
              <button aria-label="Close menu" onClick={() => setDrawer(false)} className="absolute right-2 top-2 rounded p-1 text-white/80 hover:text-white"><X size={20} /></button>
            </div>
          </div>
        </div>
      )}
      <div className="lg:pl-[72px] xl:pl-[244px]">
        <header className="relative h-[58px]">
          <div className="flex h-full items-center gap-3 px-4 lg:hidden">
            <button aria-label="Open menu" onClick={() => setDrawer(true)} className="rounded-md p-1.5 text-ink-900 hover:bg-black/5"><List size={24} /></button>
            <CougarHead width={40} height={36} />
            <span className="font-display-b text-[18px] text-fdr-red">FDRHS</span>
          </div>
          <nav aria-label="Sections" className="absolute bottom-0 left-[89px] hidden h-[58px] 2xl:block">
            {TOP.map(({ href, label, Icon, x, w }) => {
              const active = isActive(pathname, href);
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined}
                  className={`absolute top-[10px] flex h-[46px] items-center justify-center gap-2 whitespace-nowrap text-[13.5px] font-medium ${active ? 'rounded-t-[8px] border-b-[3px] border-fdr-red bg-white pt-[2px] text-fdr-red shadow-[0_1px_3px_rgb(0_0_0/.06)]' : 'text-ink-900 hover:text-fdr-red'}`}
                  style={{ left: x - 333, width: active ? w : w + 12, marginLeft: active ? 0 : -6 }}>
                  <Icon size={18} weight={active && href === '/' ? 'fill' : 'regular'} />{label}
                </Link>
              );
            })}
          </nav>
          <nav aria-label="Sections" className="absolute bottom-0 left-6 hidden h-[58px] items-end gap-1 lg:flex 2xl:hidden">
            {TOP.map(({ href, label, Icon }) => {
              const active = isActive(pathname, href);
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined} className={`flex h-[46px] items-center gap-1.5 whitespace-nowrap px-3 text-[13px] font-medium ${active ? 'rounded-t-[8px] border-b-[3px] border-fdr-red bg-white text-fdr-red' : 'text-ink-900 hover:text-fdr-red'}`}>
                  <Icon size={17} weight={active && href === '/' ? 'fill' : 'regular'} /><span className="hidden xl:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="absolute right-4 top-[10px] flex items-center gap-3 sm:gap-6 2xl:right-[164px]">
            <div className="hidden sm:block"><BrainPill variant="a" /></div>
            <NotificationBell variant="a" />
            <AvatarMenu variant="a" />
          </div>
          {pathname === '/' && <div aria-hidden className="pointer-events-none absolute right-[24px] top-[12px] hidden text-[10.5px] font-semibold leading-[15.5px] tracking-[.32em] text-[#74767A] 3xl:block">BUILD<br />CODE<br />SOLVE<br />LEAD</div>}
        </header>
        <main className="pb-24 md:pb-8">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
