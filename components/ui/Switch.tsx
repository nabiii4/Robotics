'use client';
import * as S from '@radix-ui/react-switch';
export function Switch({ checked, onCheckedChange, label, disabled }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <S.Root aria-label={label} disabled={disabled} checked={checked} onCheckedChange={onCheckedChange} className="relative h-[22px] w-[40px] shrink-0 rounded-full bg-[#D5D8DD] transition-colors data-[state=checked]:bg-fdr-red disabled:opacity-40">
      <S.Thumb className="block h-[18px] w-[18px] translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[20px]" />
    </S.Root>
  );
}
