'use client';
import { useMemo, useRef, useState } from 'react';
import { Camera, CornersOut, Ruler, Scissors } from '@phosphor-icons/react';
import { generate } from '@/lib/robot/generator';
import { OVERRIDE, seasonForProgram } from '@/lib/robot/seasons';
import { useMe } from '../shell/AppShell';
import { LazyRobotCanvas, ViewerToolbar, ViewPresets, type Derived, type Preset, type ViewerApi } from '../viewer3d/Viewer';
import { SubsystemDot } from '../dashboard/shared';
import { Switch } from '../ui/Switch';
import { Tip } from '../ui/Tip';

function Slider({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '%', extra }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; extra?: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]"><span className="font-semibold text-ink-700">{label}</span><span className="tabular text-ink-500">{value}{suffix}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#C8061C]" aria-label={label} />
      {extra}
    </div>
  );
}

export function ModelTab({ d }: { d: Derived }) {
  const { me } = useMe();
  const apiRef = useRef<ViewerApi | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [preset, setPreset] = useState<Preset>('iso');
  const [pan, setPan] = useState(false);
  const [explode, setExplode] = useState(0);
  const [pose, setPose] = useState(0);
  const [sizing, setSizing] = useState(false);
  const [hardware, setHardware] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [measure, setMeasure] = useState(false);
  const [dist, setDist] = useState<number | null>(null);
  const [section, setSection] = useState<{ axis: 'x' | 'y' | 'z'; value: number } | null>(null);
  const posed = useMemo(() => (pose === 0 ? d.parts : generate(d.spec, { pose: pose / 100 }).parts), [d.parts, d.spec, pose]);
  const hasPose = d.spec.subsystems.some((s) => ['lift', 'clamp', 'launcher', 'accessory'].includes(s.type) || (s as { pivot?: string }).pivot === 'pivoting');
  const subs = [{ id: 'drivetrain', name: 'Drivetrain' }, ...d.spec.subsystems.map((s) => ({ id: s.id, name: s.name })), { id: 'electronics', name: 'Electronics' }];
  const size = (d.spec.meta.program === 'Practice' ? OVERRIDE : seasonForProgram(d.spec.meta.program)).rules.startSizeIn.value as [number, number, number];
  const ext = { x: [d.bbox.min[0], d.bbox.max[0]], y: [d.bbox.min[1], d.bbox.max[1]], z: [d.bbox.min[2], d.bbox.max[2]] } as const;
  const m = d.metrics;

  const shot = () => {
    const url = apiRef.current?.screenshot();
    if (!url) return;
    const a = document.createElement('a'); a.href = url; a.download = `${d.build.drawingPrefix}_v${d.version}.png`; a.click();
  };
  const full = () => { const el = wrap.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.(); };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_280px]">
      <div ref={wrap} className="viewer-bg relative h-[calc(100vh-260px)] min-h-[480px] overflow-hidden rounded-[10px]">
        <LazyRobotCanvas className="absolute inset-0" apiRef={apiRef} parts={posed} bbox={d.bbox} explode={explode / 100} showHardware={hardware} hidden={hidden} highlight={hover}
          sizingBox={sizing ? size[0] : null} accent={d.spec.appearance.accentColor} metal={d.spec.appearance.metal} quality={me.prefs.quality} reduceMotion={me.prefs.reduceMotion} brainLabel={d.build.name}
          measure={measure} onMeasure={setDist} section={section} />
        <ViewerToolbar className="absolute left-4 top-4" api={() => apiRef.current} pan={pan} setPan={setPan} />
        <div className="absolute right-4 top-4 flex gap-1.5">
          <Tip label={measure ? 'Measuring — click two points on the robot' : 'Measure distance'}><button aria-pressed={measure} aria-label="Measure" onClick={() => setMeasure(!measure)} className={`btn h-[38px] w-[38px] rounded-[6px] p-0 ${measure ? 'btn-primary' : 'btn-dark'}`}><Ruler size={18} /></button></Tip>
          <Tip label="Screenshot (PNG)"><button aria-label="Screenshot" onClick={shot} className="btn btn-dark h-[38px] w-[38px] rounded-[6px] p-0"><Camera size={18} /></button></Tip>
          <Tip label="Full screen"><button aria-label="Full screen" onClick={full} className="btn btn-dark h-[38px] w-[38px] rounded-[6px] p-0"><CornersOut size={18} /></button></Tip>
        </div>
        {measure && <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-md bg-[rgb(18_21_25/.9)] px-3 py-1.5 text-[12.5px] text-white">{dist == null ? 'Click two points on the robot' : <>Distance: <b className="text-[#FCC100]">{dist.toFixed(2)} in</b> ({(dist * 25.4).toFixed(1)} mm)</>}</div>}
        <ViewPresets className="absolute bottom-4 left-4" value={preset} onChange={(p) => { setPreset(p); apiRef.current?.preset(p); }} />
      </div>

      <div className="grid content-start gap-4">
        <section className="card rounded-[10px] p-4">
          <h3 className="mb-2 text-[13px] font-bold text-ink-900">Robot specs</h3>
          {[['Starting size', `${m.startSize.length} × ${m.startSize.width} × ${m.startSize.height} in`], ['Max height', `${m.maxHeight} in`], ['Weight (est.)', `${m.weightLb} lb`], ['Top speed', `${m.topSpeedFtPerS} ft/s`], ['Motors', `${m.motors11W} × 11W${m.motors55W ? ` + ${m.motors55W} × 5.5W` : ''} · ${m.motorPowerW} W`], ['Parts', `${m.partCount}`]].map(([k, v]) => (
            <div key={k} className="flex justify-between py-0.5 text-[12.5px]"><span className="text-ink-500">{k}</span><span className="tabular font-medium text-ink-900">{v}</span></div>
          ))}
        </section>
        <section className="card grid gap-4 rounded-[10px] p-4">
          <Slider label="Explode" value={explode} onChange={setExplode} />
          {hasPose && <Slider label="Pose (lift / pistons)" value={pose} onChange={setPose} extra={<button className="mt-1 text-[11.5px] font-semibold text-fdr-red hover:underline" onClick={() => setPose(0)}>Snap to starting size</button>} />}
          <label className="flex items-center justify-between text-[12.5px] text-ink-800">{size[0]}″ sizing box <Switch checked={sizing} onCheckedChange={setSizing} label="Sizing box" /></label>
          <label className="flex items-center justify-between text-[12.5px] text-ink-800">Show hardware <Switch checked={hardware} onCheckedChange={setHardware} label="Show hardware" /></label>
        </section>
        <section className="card rounded-[10px] p-4">
          <h3 className="mb-2 text-[13px] font-bold text-ink-900">Subsystems</h3>
          {subs.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-1 text-[12.5px]" onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
              {s.id !== 'electronics' ? <SubsystemDot buildId={d.build.id} sub={{ id: s.id, name: s.name, status: d.statuses[s.id] ?? 'planned' }} onHover={setHover} /> : <span className="block h-[10px] w-[10px]" />}
              <span className="flex-1 text-ink-800">{s.name}</span>
              <Switch checked={!hidden.has(s.id)} onCheckedChange={(on) => setHidden((h) => { const n = new Set(h); if (on) n.delete(s.id); else n.add(s.id); return n; })} label={`Show ${s.name}`} />
            </div>
          ))}
        </section>
        <section className="card rounded-[10px] p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-ink-900"><Scissors size={15} />Section plane</h3>
          <div className="mb-2 flex gap-1">
            {(['off', 'x', 'y', 'z'] as const).map((a) => (
              <button key={a} aria-pressed={(section?.axis ?? 'off') === a} onClick={() => setSection(a === 'off' ? null : { axis: a, value: Math.round(((ext[a][0] + ext[a][1]) / 2) * 10) / 10 })}
                className={`flex-1 rounded-md border py-1 text-[12px] font-semibold ${(section?.axis ?? 'off') === a ? 'border-fdr-red bg-[#FFF5F5] text-fdr-red' : 'border-line text-ink-700'}`}>{a === 'off' ? 'Off' : a.toUpperCase()}</button>
            ))}
          </div>
          {section && <Slider label={`Cut at ${section.axis.toUpperCase()}`} value={section.value} min={Math.floor(ext[section.axis][0])} max={Math.ceil(ext[section.axis][1])} step={0.1} suffix=" in" onChange={(v) => setSection({ ...section, value: v })} />}
        </section>
      </div>
    </div>
  );
}
