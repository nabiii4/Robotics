import { COUGAR_BRAND, COUGAR_DARK, COUGAR_GRAY } from './cougarPaths';
import { SCHOOL_SKETCH } from './sketchPaths';

export function CougarHead({ width = 96, height = 76, palette = 'brand', className = '', flip = false }: { width?: number; height?: number; palette?: 'brand' | 'dark' | 'gray'; className?: string; flip?: boolean }) {
  const p = palette === 'dark' ? COUGAR_DARK : palette === 'gray' ? COUGAR_GRAY : COUGAR_BRAND;
  return (
    <svg width={width} height={height} viewBox="0 0 120 112" aria-hidden className={className}>
      <g transform={flip ? 'translate(120 0) scale(-1 1)' : undefined} dangerouslySetInnerHTML={{ __html: p }} />
    </svg>
  );
}

/** Layout A sidebar logo lockup: cougar + varsity "FDRHS" (red fill, white inline, black outline) + tagline */
export function LogoA() {
  return (
    <div className="relative h-[86px] w-[300px]">
      <CougarHead width={96} height={76} className="absolute left-[10px] top-[6px]" />
      <svg width="170" height="50" viewBox="0 0 170 50" role="img" aria-label="FDRHS" className="absolute left-[110px] top-[10px]">
        <g fontFamily="var(--font-graduate), serif" fontSize="50">
          <text x="3" y="46" textLength="164" lengthAdjust="spacingAndGlyphs" fill="#0C0E12" stroke="#0C0E12" strokeWidth="8" strokeLinejoin="round">FDRHS</text>
          <text x="3" y="46" textLength="164" lengthAdjust="spacingAndGlyphs" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="4" strokeLinejoin="round">FDRHS</text>
          <text x="3" y="46" textLength="164" lengthAdjust="spacingAndGlyphs" fill="#D1071B">FDRHS</text>
        </g>
      </svg>
      <div className="absolute left-[111px] top-[64px] whitespace-nowrap text-[10px] font-bold leading-[13px] tracking-[.045em] text-white">ROBOTICS &amp; COMPUTER SCIENCE</div>
    </div>
  );
}

export function LogoAMini() {
  return <CougarHead width={46} height={40} />;
}

/** Layout B top-bar logo: cougar + heavy red italic "FDRHS" + "ROBOTICS" between rules */
export function LogoB({ className = '' }: { className?: string }) {
  return (
    <svg width="200" height="50" viewBox="0 0 200 50" role="img" aria-label="FDRHS Robotics" className={className}>
      <g transform="translate(0 2) scale(0.41)" dangerouslySetInnerHTML={{ __html: COUGAR_BRAND }} />
      <text x="61" y="31" transform="skewX(-10)" fontFamily="var(--font-archivo), sans-serif" fontWeight="900" fontSize="31" letterSpacing="0.5" fill="#C8061C" stroke="#0C0E12" strokeWidth="2" paintOrder="stroke" strokeLinejoin="round">FDRHS</text>
      <line x1="56" y1="42.5" x2="71" y2="42.5" stroke="#121418" strokeWidth="1" />
      <line x1="150" y1="42.5" x2="165" y2="42.5" stroke="#121418" strokeWidth="1" />
      <text x="110.5" y="45.5" textAnchor="middle" fontFamily="var(--font-inter), sans-serif" fontWeight="700" fontSize="8.5" letterSpacing="3.6" fill="#121418">ROBOTICS</text>
    </svg>
  );
}

/** Layout B hero banner: diagonal red + black stripes into a black panel with a roaring cougar (red eye) */
export function HubBanner({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 532 184" preserveAspectRatio="xMaxYMid slice" aria-hidden className={className}>
      <defs>
        <linearGradient id="bPanel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#16191D" /><stop offset="1" stopColor="#08090B" /></linearGradient>
        <radialGradient id="bGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#FF2A3D" stopOpacity=".75" /><stop offset="1" stopColor="#FF2A3D" stopOpacity="0" /></radialGradient>
        <radialGradient id="bLight" cx="0.62" cy="0.35" r="0.6"><stop offset="0" stopColor="#2A3037" stopOpacity=".9" /><stop offset="1" stopColor="#2A3037" stopOpacity="0" /></radialGradient>
        <clipPath id="bClip"><polygon points="212,0 532,0 532,184 367,184" /></clipPath>
      </defs>
      <polygon points="96,0 142,0 297,184 251,184" fill="#C8102E" />
      <polygon points="159,0 194,0 349,184 314,184" fill="#111316" />
      <polygon points="212,0 532,0 532,184 367,184" fill="url(#bPanel)" />
      <g clipPath="url(#bClip)">
        <rect x="200" y="0" width="332" height="184" fill="url(#bLight)" />
        <g transform="translate(478 4) scale(-1.6 1.6)" dangerouslySetInnerHTML={{ __html: COUGAR_DARK }} />
        <circle cx="355" cy="64" r="16" fill="url(#bGlow)" />
      </g>
    </svg>
  );
}

export function SchoolSketch({ className = '' }: { className?: string }) {
  return <svg viewBox="0 0 510 190" aria-hidden className={className} dangerouslySetInnerHTML={{ __html: SCHOOL_SKETCH }} />;
}

export function CougarWatermark() {
  return (
    <div aria-hidden className="pointer-events-none absolute left-0 top-[86px] h-[150px] w-[245px] overflow-hidden opacity-35" style={{ maskImage: 'linear-gradient(to bottom, #000 35%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, #000 35%, transparent 100%)' }}>
      <CougarHead width={250} height={233} palette="gray" className="absolute -left-[6px] -top-[44px]" />
    </div>
  );
}
