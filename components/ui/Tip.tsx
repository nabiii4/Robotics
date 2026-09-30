'use client';
import * as T from '@radix-ui/react-tooltip';

export function Tip({ label, children, side = 'top' }: { label: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={6} className="z-[80] max-w-[280px] rounded-md bg-ink-900 px-2.5 py-1.5 text-[12px] text-white shadow-lg">
          {label}
          <T.Arrow className="fill-ink-900" />
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
