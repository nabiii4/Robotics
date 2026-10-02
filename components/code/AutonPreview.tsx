'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowClockwise, ArrowCounterClockwise, Pause, Play, Warning } from '@phosphor-icons/react';
import { api } from '@/lib/client/api';
import { frameAt, parseAuton, simulate, type Pose } from '@/lib/vexcode/auton';
import type { ProjectFile } from '@/lib/vexcode/check';
import type { Metrics } from '@/lib/robot/metrics';

const FIELD = 144; // inches (12 ft)

export function AutonPreview({ files, metrics, buildId, start: initialStart, autonSeconds = 15, onJump }: { files: ProjectFile[]; metrics: Metrics | undefined; buildId: string; start: Pose | null; autonSeconds?: number; onJump?: (file: string, line: number) => void }) {
  const [start, setStart] = useState<Pose>(initialStart ?? { x: 36, y: 18, heading: 0 });
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [px, setPx] = useState(420);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const parsed = useMemo(() => parseAuton(files), [files]);
  const robot = { wheelRpm: metrics?.wheelRpm ?? 200, wheelDiameterIn: metrics?.wheelDiameterIn ?? 4, trackWidthIn: metrics?.trackWidthIn ?? 12 };
  const L = metrics?.startSize.length ?? 18, W = metrics?.startSize.width ?? 18;
  const sim = useMemo(() => simulate(parsed.cmds, robot, start), [parsed, start, robot.wheelRpm, robot.wheelDiameterIn, robot.trackWidthIn]); // eslint-disable-line react-hooks/exhaustive-deps
  const cur = frameAt(sim, t);
  const activeLine = sim.segments.find((s) => t >= s.t0 && t < s.t1)?.line;

  useEffect(() => { const ro = new ResizeObserver(([e]) => setPx(Math.max(260, Math.min(560, Math.floor(e.contentRect.width))))); if (wrap.current) ro.observe(wrap.current); return () => ro.disconnect(); }, []);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => { const dt = ((now - last) / 1000) * speed; last = now; setT((v) => { const n = v + dt; if (n >= sim.total) { setPlaying(false); return sim.total; } return n; }); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, sim.total]);

  // draw
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = px * dpr; c.height = px * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const s = px / FIELD;
    const X = (x: number) => x * s, Y = (y: number) => px - y * s;
    g.fillStyle = '#8D949B'; g.fillRect(0, 0, px, px);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { g.fillStyle = (i + j) % 2 ? '#9AA1A8' : '#959CA3'; g.fillRect(i * 24 * s, j * 24 * s, 24 * s, 24 * s); }
    g.strokeStyle = '#C7CCD1'; g.lineWidth = 1;
    for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(i * 24 * s, 0); g.lineTo(i * 24 * s, px); g.stroke(); g.beginPath(); g.moveTo(0, i * 24 * s); g.lineTo(px, i * 24 * s); g.stroke(); }
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, px / 2); g.lineTo(px, px / 2); g.stroke();
    // path
    g.strokeStyle = '#C8102E'; g.lineWidth = 2.5; g.beginPath();
    sim.frames.forEach((f, i) => (i ? g.lineTo(X(f.x), Y(f.y)) : g.moveTo(X(f.x), Y(f.y)))); g.stroke();
    // events
    for (const e of sim.events) { const f = frameAt(sim, e.t); g.fillStyle = '#FCC100'; g.beginPath(); g.arc(X(f.x), Y(f.y), 4, 0, Math.PI * 2); g.fill(); }
    // ghost at start
    const drawRobot = (p: Pose, alpha: number) => {
      g.save(); g.translate(X(p.x), Y(p.y)); g.rotate((p.heading * Math.PI) / 180); g.globalAlpha = alpha;
      g.fillStyle = '#2C2F33'; g.strokeStyle = '#C8102E'; g.lineWidth = 2;
      g.fillRect((-W / 2) * s, (-L / 2) * s, W * s, L * s); g.strokeRect((-W / 2) * s, (-L / 2) * s, W * s, L * s);
      g.fillStyle = '#FCC100'; g.beginPath(); g.moveTo(0, (-L / 2) * s - 2); g.lineTo(-6, (-L / 2) * s + 9); g.lineTo(6, (-L / 2) * s + 9); g.closePath(); g.fill();
      g.restore();
    };
    if (t > 0) drawRobot(start, 0.3);
    drawRobot({ x: cur.x, y: cur.y, heading: cur.h }, 1);
  }, [px, sim, t, cur.x, cur.y, cur.h, start, L, W]);

  const toField = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * FIELD, y: FIELD - ((e.clientY - r.top) / r.height) * FIELD }; };
  const clamp = (v: number) => Math.max(0, Math.min(FIELD, Math.round(v * 2) / 2));
  const save = (p: Pose) => { api.patch(`/api/builds/${buildId}`, { autonStart: p }).catch(() => {}); };
  const rotate = (deg: number) => { const p = { ...start, heading: ((start.heading + deg) % 360 + 360) % 360 }; setStart(p); setT(0); save(p); };
  const over = sim.total > autonSeconds;

  return (
    <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-[auto_1fr]">
      <div ref={wrap} className="w-full max-w-[560px] md:w-[420px]">
        <canvas ref={canvas} style={{ width: px, height: px }} className="cursor-grab touch-none rounded-[6px] active:cursor-grabbing" aria-label="Top-down field preview — drag the robot to set the start position"
          onPointerDown={(e) => { if (t > 0) setT(0); const f = toField(e); drag.current = { dx: f.x - start.x, dy: f.y - start.y }; (e.target as HTMLElement).setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (!drag.current) return; const f = toField(e); setStart((p) => ({ ...p, x: clamp(f.x - drag.current!.dx), y: clamp(f.y - drag.current!.dy) })); }}
          onPointerUp={() => { if (drag.current) { drag.current = null; save(start); } }} />
      </div>
      <div className="min-w-0 text-[12.5px] text-[#D4D4D4]">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button className="btn btn-primary h-8 text-[12px]" disabled={!parsed.cmds.length} onClick={() => { if (t >= sim.total) setT(0); setPlaying(!playing); }}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? 'Pause' : 'Play'}</button>
          <button className="btn btn-dark h-8 text-[12px]" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{speed}×</button>
          <button className="btn btn-dark h-8 w-8 p-0" aria-label="Rotate start left" onClick={() => rotate(-15)}><ArrowCounterClockwise size={14} /></button>
          <button className="btn btn-dark h-8 w-8 p-0" aria-label="Rotate start right" onClick={() => rotate(15)}><ArrowClockwise size={14} /></button>
          <span className="tabular text-white/60">start ({start.x}, {start.y}) in · {Math.round(start.heading)}°</span>
        </div>
        <input type="range" min={0} max={Math.max(0.01, sim.total)} step={0.01} value={t} onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }} className="w-full accent-[#C8061C]" aria-label="Timeline" />
        <div className="tabular mt-1 flex justify-between text-white/70"><span>{t.toFixed(1)} s</span><span className={over ? 'font-semibold text-[#FF8A80]' : ''}>{sim.total.toFixed(1)} s / {autonSeconds} s</span></div>
        {over && <div className="mt-2 flex items-center gap-1.5 text-[#FF8A80]"><Warning size={14} />This routine runs {(sim.total - autonSeconds).toFixed(1)} s past the {autonSeconds} s autonomous period.</div>}
        {!parsed.fn && <p className="mt-3 text-white/70">No <code>autonomous()</code> or <code>auton()</code> function found in this project.</p>}
        {parsed.fn && <p className="mt-2 text-white/50">Previewing <code className="text-white/80">{parsed.fn}()</code> in {parsed.file}</p>}
        <ol className="scroll-thin mt-2 max-h-[220px] overflow-y-auto font-mono text-[11.5px]">
          {parsed.cmds.map((c, i) => <li key={i}><button onClick={() => onJump?.(c.file, c.line)} className={`w-full truncate rounded px-1.5 py-0.5 text-left hover:bg-white/10 ${c.line === activeLine ? 'bg-white/15 text-white' : ''}`}><span className="text-white/40">{c.line}</span> {c.text}</button></li>)}
          {parsed.skipped.map((c, i) => <li key={`s${i}`}><button onClick={() => onJump?.(c.file, c.line)} className="w-full truncate rounded px-1.5 py-0.5 text-left text-white/40 hover:bg-white/10"><span>{c.line}</span> {c.text} <i>(skipped)</i></button></li>)}
        </ol>
        <p className="mt-2 text-[11.5px] text-white/50">Preview (approximate) — real robots drift; tune on the field.</p>
      </div>
    </div>
  );
}
