'use client';
import * as D from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';

export function Dialog({ open, onOpenChange, title, description, children, width = 520, footer }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; width?: number; footer?: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/40 data-[state=open]:animate-[fade_.2s]" />
        <D.Content className="fixed left-1/2 top-1/2 z-[61] flex max-h-[calc(100vh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[12px] bg-white shadow-[0_24px_60px_rgb(16_24_40/.3)]" style={{ maxWidth: width }}>
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <D.Title className="text-[17px] font-bold text-ink-900">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-[13px] text-ink-500">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close aria-label="Close" className="rounded-md p-1 text-ink-400 hover:bg-[#F6F7F9] hover:text-ink-900"><X size={18} /></D.Close>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Drawer({ open, onOpenChange, title, children, width = 460 }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: React.ReactNode; width?: number }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/30" />
        <D.Content className="fixed right-0 top-0 z-[61] flex h-full w-full flex-col bg-white shadow-[-8px_0_32px_rgb(16_24_40/.18)]" style={{ maxWidth: width }}>
          <D.Title className="sr-only">{title}</D.Title>
          <D.Description className="sr-only">{title}</D.Description>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
