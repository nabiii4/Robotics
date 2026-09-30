import { HubBanner, LogoB } from '@/components/brand/Brand';

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#0B0C0E] lg:block">
        <HubBanner className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-x-12 bottom-14">
          <p className="text-[13px] font-medium tracking-[.16em] text-white/70">FRANKLIN D. ROOSEVELT HIGH SCHOOL</p>
          <h1 className="font-display-b mt-2 text-[56px] leading-[1.02] text-white">Build. <span className="text-fdr-red-bright">Code.</span> Compete.</h1>
          <p className="mt-3 max-w-md text-[17px] text-white/75">The FDR Cougars robotics engineering hub — design with the AI Build Mentor, print parts, and get competition ready.</p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-page-b px-4 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex justify-center"><LogoB /></div>
          {children}
        </div>
      </div>
    </div>
  );
}
