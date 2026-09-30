'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { House, Cube, Robot, Printer, DotsThree } from '@phosphor-icons/react';
import { useMentor } from '@/lib/client/stores';
import { isActive } from './HeaderItems';
import { Menu, MenuTrigger, MenuContent, MenuItem } from '../ui/Menu';

/** Phone (<768px): bottom tab bar — Dashboard · Builds · Mentor · Printer · More */
export function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const openMentor = useMentor((s) => s.openDrawer);
  const item = (active: boolean) => `flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? 'text-fdr-red' : 'text-ink-600'}`;
  return (
    <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-40 flex h-[62px] border-t border-line bg-white md:hidden">
      <Link href="/" className={item(pathname === '/')}><House size={22} weight={pathname === '/' ? 'fill' : 'regular'} />Dashboard</Link>
      <Link href="/builds" className={item(isActive(pathname, '/builds'))}><Cube size={22} />Builds</Link>
      <button onClick={() => openMentor()} className={item(false)}><Robot size={22} />Mentor</button>
      <Link href="/printer" className={item(isActive(pathname, '/printer'))}><Printer size={22} />Printer</Link>
      <Menu>
        <MenuTrigger asChild><button className={item(false)}><DotsThree size={22} weight="bold" />More</button></MenuTrigger>
        <MenuContent>
          {[['/parts', 'Parts & Inventory'], ['/code', 'VEX Code'], ['/team', 'Team'], ['/competitions', 'Competitions'], ['/resources', 'Resources'], ['/mentor', 'Mentor (full page)'], ['/settings', 'Settings']].map(([h, l]) => (
            <MenuItem key={h} onSelect={() => router.push(h)}>{l}</MenuItem>
          ))}
        </MenuContent>
      </Menu>
    </nav>
  );
}
