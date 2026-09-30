'use client';
import * as M from '@radix-ui/react-dropdown-menu';

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export function MenuContent({ children, align = 'end', width = 220 }: { children: React.ReactNode; align?: 'start' | 'end' | 'center'; width?: number }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className="z-[70] rounded-[10px] border border-line bg-white p-1 shadow-[0_12px_32px_rgb(16_24_40/.16)]" style={{ minWidth: width }}>
        {children}
      </M.Content>
    </M.Portal>
  );
}
export function MenuItem({ children, onSelect, danger, disabled }: { children: React.ReactNode; onSelect?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <M.Item disabled={disabled} onSelect={onSelect} className={`flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-[#F3F4F6] ${danger ? 'text-fdr-red' : 'text-ink-900'}`}>
      {children}
    </M.Item>
  );
}
export const MenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => <M.Label className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{children}</M.Label>;
export const MenuSub = M.Sub;
export function MenuSubTrigger({ children }: { children: React.ReactNode }) {
  return <M.SubTrigger className="flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-[#F3F4F6] data-[state=open]:bg-[#F3F4F6]">{children}</M.SubTrigger>;
}
export function MenuSubContent({ children }: { children: React.ReactNode }) {
  return <M.Portal><M.SubContent sideOffset={4} className="z-[71] min-w-[200px] rounded-[10px] border border-line bg-white p-1 shadow-[0_12px_32px_rgb(16_24_40/.16)]">{children}</M.SubContent></M.Portal>;
}
