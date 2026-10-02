// Vector engineering sheets (spec §16): assembly, drivetrain, subsystems, printed parts; dashboard thumbnails.
import type { PartInstance } from '../robot/generator/core';
import type { Metrics } from '../robot/metrics';
import type { BomRow } from '../robot/bom';
import type { RobotSpec } from '../robot/spec';
import { generate } from '../robot/generator';
import { projectView, project3, type ViewName, type ViewResult } from './project';
import { COUGAR_BRAND } from '../../components/brand/cougarPaths';

export type ThemeName = 'blueprint' | 'navy' | 'paper';
export const THEMES: Record<ThemeName, { bg: string; line: string; grid: string | null; text: string; dim: string; fill: string }> = {
  blueprint: { bg: '#0F5CB2', line: 'rgba(255,255,255,0.92)', grid: 'rgba(255,255,255,0.08)', text: '#FFFFFF', dim: 'rgba(255,255,255,0.8)', fill: '#0F5CB2' },
  navy: { bg: '#1E2833', line: '#C9CED4', grid: 'rgba(255,255,255,0.06)', text: '#C9CED4', dim: '#AEB6BE', fill: '#1E2833' },
  paper: { bg: '#FFFFFF', line: '#111111', grid: null, text: '#111111', dim: '#333333', fill: '#FFFFFF' },
};

const IN = 25.4;
const f2 = (n: number) => n.toFixed(2);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

type Tx = (x: number, y: number) => [number, number];

function viewSvg(vr: ViewResult, tx: Tx, th: (typeof THEMES)[ThemeName], stroke = 0.3) {
  const out: string[] = [];
  for (const s of vr.shapes) {
    const d = s.pts.map((p, i) => { const [x, y] = tx(p[0], p[1]); return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`; }).join('') + 'Z';
    out.push(`<path d="${d}" fill="${th.fill}" stroke="${th.line}" stroke-width="${s.ghost ? stroke * 0.6 : stroke}"${s.ghost ? ' stroke-dasharray="1.2 0.8" fill-opacity="0"' : ''} stroke-linejoin="round"/>`);
  }
  return out.join('');
}

function fitTx(vr: ViewResult, box: [number, number, number, number], scale?: number): { tx: Tx; s: number; bbox: [number, number, number, number] } {
  const [bx, by, bw, bh] = box;
  const w = vr.max[0] - vr.min[0] || 1, h = vr.max[1] - vr.min[1] || 1;
  const s = scale ?? Math.min(bw / w, bh / h);
  const ox = bx + (bw - w * s) / 2 - vr.min[0] * s, oy = by + (bh - h * s) / 2 - vr.min[1] * s;
  return { tx: (x, y) => [ox + x * s, oy + y * s], s, bbox: [ox + vr.min[0] * s, oy + vr.min[1] * s, w * s, h * s] };
}

function arrow(x: number, y: number, ang: number, color: string, size = 2.2) {
  const a1 = ang + Math.PI - 0.35, a2 = ang + Math.PI + 0.35;
  return `<path d="M${f2(x)} ${f2(y)}L${f2(x + Math.cos(a1) * size)} ${f2(y + Math.sin(a1) * size)}L${f2(x + Math.cos(a2) * size)} ${f2(y + Math.sin(a2) * size)}Z" fill="${color}"/>`;
}

/** linear dimension between two points (drawing units), offset perpendicular */
function dim(x1: number, y1: number, x2: number, y2: number, off: number, label: string, th: (typeof THEMES)[ThemeName], fs = 2.6) {
  const horiz = Math.abs(y2 - y1) < Math.abs(x2 - x1);
  const c = th.dim;
  const parts: string[] = [];
  if (horiz) {
    const y = Math.max(y1, y2) + off * Math.sign(off || 1);
    const yy = off < 0 ? Math.min(y1, y2) + off : y;
    parts.push(`<line x1="${f2(x1)}" y1="${f2(y1 + Math.sign(yy - y1) * 1.5)}" x2="${f2(x1)}" y2="${f2(yy + Math.sign(yy - y1) * 1.2)}" stroke="${c}" stroke-width="0.12"/>`);
    parts.push(`<line x1="${f2(x2)}" y1="${f2(y2 + Math.sign(yy - y2) * 1.5)}" x2="${f2(x2)}" y2="${f2(yy + Math.sign(yy - y2) * 1.2)}" stroke="${c}" stroke-width="0.12"/>`);
    parts.push(`<line x1="${f2(x1)}" y1="${f2(yy)}" x2="${f2(x2)}" y2="${f2(yy)}" stroke="${c}" stroke-width="0.15"/>`);
    parts.push(arrow(x1, yy, Math.PI, c), arrow(x2, yy, 0, c));
    parts.push(`<text x="${f2((x1 + x2) / 2)}" y="${f2(yy - 0.9)}" font-size="${fs}" text-anchor="middle" fill="${th.text}" font-family="Inter, Arial, sans-serif">${esc(label)}</text>`);
  } else {
    const xx = off < 0 ? Math.min(x1, x2) + off : Math.max(x1, x2) + off;
    parts.push(`<line x1="${f2(x1 + Math.sign(xx - x1) * 1.5)}" y1="${f2(y1)}" x2="${f2(xx + Math.sign(xx - x1) * 1.2)}" y2="${f2(y1)}" stroke="${c}" stroke-width="0.12"/>`);
    parts.push(`<line x1="${f2(x2 + Math.sign(xx - x2) * 1.5)}" y1="${f2(y2)}" x2="${f2(xx + Math.sign(xx - x2) * 1.2)}" y2="${f2(y2)}" stroke="${c}" stroke-width="0.12"/>`);
    parts.push(`<line x1="${f2(xx)}" y1="${f2(y1)}" x2="${f2(xx)}" y2="${f2(y2)}" stroke="${c}" stroke-width="0.15"/>`);
    parts.push(arrow(xx, y1, -Math.PI / 2, c), arrow(xx, y2, Math.PI / 2, c));
    parts.push(`<text x="${f2(xx - 0.9)}" y="${f2((y1 + y2) / 2)}" font-size="${fs}" text-anchor="middle" fill="${th.text}" font-family="Inter, Arial, sans-serif" transform="rotate(-90 ${f2(xx - 0.9)} ${f2((y1 + y2) / 2)})">${esc(label)}</text>`);
  }
  return parts.join('');
}

function frame(W: number, H: number, th: (typeof THEMES)[ThemeName]) {
  const out: string[] = [`<rect width="${W}" height="${H}" fill="${th.bg}"/>`];
  if (th.grid) {
    out.push(`<defs><pattern id="g5" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M5 0H0V5" fill="none" stroke="${th.grid}" stroke-width="0.2"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#g5)"/>`);
  }
  out.push(`<rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="${th.line}" stroke-width="0.6"/>`);
  out.push(`<rect x="5" y="5" width="${W - 10}" height="${H - 10}" fill="none" stroke="${th.line}" stroke-width="0.25"/>`);
  for (let i = 0; i < 8; i++) {
    const x = 10 + ((W - 20) * (i + 0.5)) / 8;
    out.push(`<text x="${f2(x)}" y="8.6" font-size="2.6" text-anchor="middle" fill="${th.text}" font-family="Inter, Arial">${i + 1}</text><text x="${f2(x)}" y="${f2(H - 6.4)}" font-size="2.6" text-anchor="middle" fill="${th.text}" font-family="Inter, Arial">${i + 1}</text>`);
    if (i) out.push(`<line x1="${f2(10 + ((W - 20) * i) / 8)}" y1="5" x2="${f2(10 + ((W - 20) * i) / 8)}" y2="10" stroke="${th.line}" stroke-width="0.25"/><line x1="${f2(10 + ((W - 20) * i) / 8)}" y1="${H - 10}" x2="${f2(10 + ((W - 20) * i) / 8)}" y2="${H - 5}" stroke="${th.line}" stroke-width="0.25"/>`);
  }
  for (let i = 0; i < 4; i++) {
    const y = 10 + ((H - 20) * (i + 0.5)) / 4;
    const L = 'ABCD'[i];
    out.push(`<text x="7.5" y="${f2(y + 0.9)}" font-size="2.6" text-anchor="middle" fill="${th.text}" font-family="Inter, Arial">${L}</text><text x="${f2(W - 7.5)}" y="${f2(y + 0.9)}" font-size="2.6" text-anchor="middle" fill="${th.text}" font-family="Inter, Arial">${L}</text>`);
  }
  return out.join('');
}

export interface SheetInfo { buildName: string; drawingPrefix: string; version: number; program: string; season: string; drawnBy: string; date: string; sizing?: [number, number, number]; sizingRef?: string }

function titleBlock(W: number, H: number, th: (typeof THEMES)[ThemeName], info: SheetInfo, sheetName: string, sheetNo: string, sheetOf: string, scale: string, units: string, tol: string) {
  const x = W - 10 - 180, y = H - 10 - 50;
  const t = (tx: number, ty: number, s: string, size = 2.4, weight = 400, anchor = 'start') => `<text x="${f2(tx)}" y="${f2(ty)}" font-size="${size}" font-weight="${weight}" fill="${th.text}" text-anchor="${anchor}" font-family="Inter, Arial, sans-serif">${esc(s)}</text>`;
  const l = (x1: number, y1: number, x2: number, y2: number) => `<line x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}" stroke="${th.line}" stroke-width="0.3"/>`;
  const label = (tx: number, ty: number, s: string) => t(tx, ty, s, 1.7, 600);
  const g: string[] = [`<rect x="${x}" y="${y}" width="180" height="50" fill="${th.bg}" stroke="${th.line}" stroke-width="0.6"/>`];
  g.push(l(x, y + 11, x + 180, y + 11), l(x, y + 23, x + 180, y + 23), l(x, y + 34, x + 180, y + 34), l(x + 60, y + 23, x + 60, y + 50), l(x + 100, y + 23, x + 100, y + 50), l(x + 140, y + 23, x + 140, y + 50), l(x + 150, y, x + 150, y + 23));
  g.push(`<g transform="translate(${x + 2} ${y + 1.2}) scale(0.078)">${COUGAR_BRAND}</g>`);
  g.push(t(x + 13, y + 7, 'FDRHS ROBOTICS & COMPUTER SCIENCE', 3.2, 800));
  g.push(label(x + 2, y + 14, 'TITLE'), t(x + 2, y + 20, `${info.buildName} — ${sheetName}`, 3.4, 700));
  g.push(label(x + 152, y + 4, 'REV'), t(x + 165, y + 17, `v${info.version}`, 6, 800, 'middle'));
  g.push(label(x + 2, y + 26, 'DRAWING NO.'), t(x + 2, y + 31, `${info.drawingPrefix}_v${info.version}-${sheetNo}`, 2.8, 700));
  g.push(label(x + 62, y + 26, 'SCALE'), t(x + 62, y + 31, scale, 2.8, 700));
  g.push(label(x + 102, y + 26, 'UNITS'), t(x + 102, y + 31, units, 2.8, 700));
  g.push(label(x + 142, y + 26, 'SHEET'), t(x + 142, y + 31, `${sheetOf}`, 2.8, 700));
  g.push(label(x + 2, y + 37, 'DRAWN BY / DATE'), t(x + 2, y + 42, `${info.drawnBy} · ${info.date}`, 2.3));
  g.push(label(x + 2, y + 45.5, 'PROGRAM / SEASON'), t(x + 2, y + 48.5, `${info.program} · ${info.season}`, 1.9));
  g.push(label(x + 62, y + 37, 'CHECKED BY'), label(x + 102, y + 37, 'TOLERANCES'), t(x + 102, y + 42, tol, 2.1));
  // third-angle projection symbol
  const sx = x + 150, sy = y + 40;
  g.push(`<g fill="none" stroke="${th.line}" stroke-width="0.25"><circle cx="${sx + 4}" cy="${sy}" r="3"/><circle cx="${sx + 4}" cy="${sy}" r="1.5"/><path d="M${sx + 11} ${sy - 3}L${sx + 21} ${sy - 1.5}L${sx + 21} ${sy + 1.5}L${sx + 11} ${sy + 3}Z"/></g>`, label(x + 142, y + 37, 'PROJECTION'), t(x + 162, y + 47.5, 'THIRD ANGLE', 1.7, 600, 'middle'));
  return g.join('');
}

function bomTable(x: number, y: number, w: number, rows: BomRow[], th: (typeof THEMES)[ThemeName], maxRows: number) {
  const out: string[] = [];
  const t = (tx: number, ty: number, s: string, size = 2.2, weight = 400, anchor = 'start') => `<text x="${f2(tx)}" y="${f2(ty)}" font-size="${size}" font-weight="${weight}" fill="${th.text}" text-anchor="${anchor}" font-family="Inter, Arial, sans-serif">${esc(s)}</text>`;
  const shown = rows.slice(0, maxRows);
  const rh = 5.2;
  out.push(`<rect x="${x}" y="${y}" width="${w}" height="${(shown.length + 1) * rh}" fill="${th.bg}" stroke="${th.line}" stroke-width="0.4"/>`);
  out.push(t(x + 2, y + 3.6, 'ITEM', 2, 700), t(x + 14, y + 3.6, 'QTY', 2, 700), t(x + 26, y + 3.6, 'PART', 2, 700), t(x + w - 2, y + 3.6, 'DETAIL / SKU', 2, 700, 'end'));
  shown.forEach((r, i) => {
    const yy = y + rh * (i + 1);
    out.push(`<line x1="${x}" y1="${f2(yy)}" x2="${x + w}" y2="${f2(yy)}" stroke="${th.line}" stroke-width="0.15"/>`);
    out.push(t(x + 2, yy + 3.6, String(i + 1)), t(x + 14, yy + 3.6, String(r.qty + (r.plannedQty ? `+${r.plannedQty}` : ''))), t(x + 26, yy + 3.6, r.name.slice(0, 34)), t(x + w - 2, yy + 3.6, (r.detail ?? r.sku ?? '').slice(0, 26), 1.9, 400, 'end'));
  });
  out.push(`<line x1="${x + 12}" y1="${y}" x2="${x + 12}" y2="${f2(y + (shown.length + 1) * rh)}" stroke="${th.line}" stroke-width="0.15"/><line x1="${x + 24}" y1="${y}" x2="${x + 24}" y2="${f2(y + (shown.length + 1) * rh)}" stroke="${th.line}" stroke-width="0.15"/>`);
  if (rows.length > maxRows) out.push(t(x + 2, y + (shown.length + 1) * rh + 3.6, `+ ${rows.length - maxRows} more rows — see the BOM export`, 1.9));
  return out.join('');
}

const SCALES: [number, string][] = [[2, '2:1'], [1, '1:1'], [0.5, '1:2'], [1 / 3, '1:3'], [0.25, '1:4'], [0.2, '1:5'], [1 / 6, '1:6'], [0.125, '1:8']];
function pickScale(fits: (s: number) => boolean) { for (const [s, l] of SCALES) if (fits(s)) return { s, l }; return { s: 0.1, l: '1:10' }; }

export function assemblySheet(parts: PartInstance[], metrics: Metrics, bom: BomRow[], info: SheetInfo, themeName: ThemeName = 'blueprint', sheetOf = '1 of 3') {
  const th = THEMES[themeName];
  const W = 431.8, H = 279.4;
  const views: Record<ViewName, ViewResult> = {
    front: projectView(parts, 'front', { ghosts: true }), top: projectView(parts, 'top', { ghosts: true }), right: projectView(parts, 'right', { ghosts: true }), iso: projectView(parts, 'iso'), left: projectView(parts, 'left'),
  };
  const sz = (v: ViewResult) => [(v.max[0] - v.min[0]) * IN, (v.max[1] - v.min[1]) * IN];
  const [fw, fh] = sz(views.front), [, th2] = sz(views.top), [rw] = sz(views.right);
  const region = { x: 22, y: 22, w: 205, h: 228 };
  const { s, l } = pickScale((k) => (fw + rw) * k + 42 <= region.w && (th2 + fh) * k + 42 <= region.h);
  const k = s * IN;
  const out: string[] = [frame(W, H, th)];
  const colX = region.x + 16, rowY = region.y + 12;
  const topBox: [number, number, number, number] = [colX, rowY, fw * s, th2 * s];
  const frontBox: [number, number, number, number] = [colX, rowY + th2 * s + 20, fw * s, fh * s];
  const rightBox: [number, number, number, number] = [colX + fw * s + 22, rowY + th2 * s + 20, rw * s, fh * s];
  const top = fitTx(views.top, topBox, k), front = fitTx(views.front, frontBox, k), right = fitTx(views.right, rightBox, k);
  out.push(viewSvg(views.top, top.tx, th), viewSvg(views.front, front.tx, th), viewSvg(views.right, right.tx, th));
  const label = (x: number, y: number, t: string) => `<text x="${f2(x)}" y="${f2(y)}" font-size="2.8" font-weight="700" fill="${th.text}" text-anchor="middle" font-family="Inter, Arial">${t}</text>`;
  out.push(label(top.bbox[0] + top.bbox[2] / 2, top.bbox[1] - 3, 'TOP'), label(front.bbox[0] + front.bbox[2] / 2, front.bbox[1] + front.bbox[3] + 17, 'FRONT'), label(right.bbox[0] + right.bbox[2] / 2, right.bbox[1] + right.bbox[3] + 17, 'RIGHT'));
  // dimensions
  const fb = front.bbox, rb = right.bbox, tb = top.bbox;
  out.push(dim(fb[0], fb[1] + fb[3], fb[0] + fb[2], fb[1] + fb[3], 8, `${f2(metrics.startSize.width)}`, th));
  out.push(dim(fb[0], fb[1], fb[0], fb[1] + fb[3], -8, `${f2(metrics.startSize.height)}`, th));
  out.push(dim(rb[0], rb[1] + rb[3], rb[0] + rb[2], rb[1] + rb[3], 8, `${f2(metrics.startSize.length)}`, th));
  const [tx1] = top.tx(-metrics.trackWidthIn / 2, 0), [tx2] = top.tx(metrics.trackWidthIn / 2, 0);
  out.push(dim(tx1, tb[1], tx2, tb[1], -5, `TRACK ${f2(metrics.trackWidthIn)}`, th, 2.2));
  const [, wy1] = top.tx(0, -metrics.wheelBaseIn / 2), [, wy2] = top.tx(0, metrics.wheelBaseIn / 2);
  out.push(dim(tb[0] + tb[2], wy1, tb[0] + tb[2], wy2, 6, `WHEELBASE ${f2(metrics.wheelBaseIn)}`, th, 2.2));
  const [, gy0] = right.tx(0, 0), [, gy1] = right.tx(0, -metrics.groundClearanceIn);
  out.push(dim(rb[0] + rb[2], gy1, rb[0] + rb[2], gy0, 6, `CLR ${f2(metrics.groundClearanceIn)}`, th, 2));
  // iso with balloons
  const isoBox: [number, number, number, number] = [rightBox[0] - 6, region.y + 4, Math.max(60, region.x + region.w - rightBox[0] + 6), th2 * s + 6];
  const iso = fitTx(views.iso, isoBox);
  out.push(viewSvg(views.iso, iso.tx, th, 0.25), label(iso.bbox[0] + iso.bbox[2] / 2, iso.bbox[1] + iso.bbox[3] + 5, 'ISOMETRIC'));
  const main = bom.filter((r) => !r.hardware).slice(0, 8);
  main.forEach((r, i) => {
    const p = parts.find((pp) => pp.bomKey === r.key && !pp.ghost) ?? parts.find((pp) => pp.bomKey === r.key);
    if (!p) return;
    const [px, py] = iso.tx(...project3(p.position, 'iso'));
    const bx = iso.bbox[0] - 8 + (i % 2) * (iso.bbox[2] + 16), by = iso.bbox[1] + 4 + Math.floor(i / 2) * (iso.bbox[3] / 4.2);
    out.push(`<line x1="${f2(bx)}" y1="${f2(by)}" x2="${f2(px)}" y2="${f2(py)}" stroke="${th.dim}" stroke-width="0.15"/><circle cx="${f2(px)}" cy="${f2(py)}" r="0.5" fill="${th.dim}"/><circle cx="${f2(bx)}" cy="${f2(by)}" r="4" fill="${th.bg}" stroke="${th.line}" stroke-width="0.3"/><text x="${f2(bx)}" y="${f2(by + 1)}" font-size="3" font-weight="700" text-anchor="middle" fill="${th.text}" font-family="Inter, Arial">${bom.indexOf(r) + 1}</text>`);
  });
  // BOM + notes
  const tableX = W - 10 - 180 + 2;
  out.push(bomTable(tableX, 16, 176, bom.filter((r) => !r.hardware).concat(bom.filter((r) => r.hardware)), th, 26));
  const sizing = info.sizing ?? [18, 18, 18];
  const notes = [
    `START SIZE ${f2(metrics.startSize.length)} × ${f2(metrics.startSize.width)} × ${f2(metrics.startSize.height)} IN`,
    `SIZING LIMIT ${sizing.map((n) => n.toFixed(2)).join(' × ')} (${info.program} ${info.sizingRef ?? '<R3>'})`,
    `WHEEL Ø ${f2(metrics.wheelDiameterIn)} · TOP SPEED ${metrics.topSpeedInPerS.toFixed(1)} IN/S · ${metrics.motorPowerW} W MOTORS`,
    metrics.liftPivotHeightIn != null ? `LIFT PIVOT HEIGHT ${f2(metrics.liftPivotHeightIn)} · ARM ${f2(metrics.armLengthIn ?? 0)} · MAX HEIGHT ${f2(metrics.maxHeight)}` : `MAX HEIGHT ${f2(metrics.maxHeight)}`,
    `EST. WEIGHT ${metrics.weightLb.toFixed(1)} LB · DASHED = PLANNED (NOT IN START SIZE)`,
  ];
  const ny = H - 10 - 50 - 6 - notes.length * 4.2;
  out.push(`<text x="${tableX}" y="${f2(ny - 2)}" font-size="2.4" font-weight="700" fill="${th.text}" font-family="Inter, Arial">NOTES</text>`);
  notes.forEach((n, i) => out.push(`<text x="${tableX}" y="${f2(ny + 2.6 + i * 4.2)}" font-size="2.1" fill="${th.text}" font-family="Inter, Arial">${i + 1}. ${esc(n)}</text>`));
  out.push(titleBlock(W, H, th, info, 'Assembly', '01', sheetOf, l, 'INCHES', '±0.03 in'));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">${out.join('')}</svg>`;
}

export function drivetrainSheet(spec: RobotSpec, parts: PartInstance[], metrics: Metrics, info: SheetInfo, themeName: ThemeName = 'blueprint', sheetOf = '2 of 3') {
  const th = THEMES[themeName];
  const W = 431.8, H = 279.4;
  const dparts = parts.filter((p) => p.subsystemId === 'drivetrain');
  const top = projectView(dparts, 'top'), side = projectView(dparts, 'right');
  const L = Math.max(top.max[1] - top.min[1], 1) * IN, Wd = Math.max(top.max[0] - top.min[0], 1) * IN;
  const { s, l } = pickScale((k) => Wd * k + 40 <= 180 && L * k + 40 <= 200 && L * k + 40 <= 180);
  const k = s * IN;
  const out: string[] = [frame(W, H, th)];
  const t = fitTx(top, [30, 30, Wd * s, L * s], k);
  const sd = fitTx(side, [30 + Wd * s + 45, 30, L * s, (side.max[1] - side.min[1]) * k], k);
  out.push(viewSvg(top, t.tx, th), viewSvg(side, sd.tx, th));
  const tb = t.bbox, sb = sd.bbox;
  out.push(dim(tb[0], tb[1] + tb[3], tb[0] + tb[2], tb[1] + tb[3], 8, `OVERALL ${f2(Wd / IN)}`, th));
  out.push(dim(tb[0], tb[1], tb[0], tb[1] + tb[3], -8, `OVERALL ${f2(L / IN)}`, th));
  const [x1] = t.tx(-metrics.trackWidthIn / 2, 0), [x2] = t.tx(metrics.trackWidthIn / 2, 0);
  out.push(dim(x1, tb[1], x2, tb[1], -6, `TRACK WIDTH ${f2(metrics.trackWidthIn)}`, th));
  const [, y1] = t.tx(0, -metrics.wheelBaseIn / 2), [, y2] = t.tx(0, metrics.wheelBaseIn / 2);
  out.push(dim(tb[0] + tb[2], y1, tb[0] + tb[2], y2, 8, `WHEELBASE ${f2(metrics.wheelBaseIn)}`, th));
  const [, gy0] = sd.tx(0, 0), [, gy1] = sd.tx(0, -metrics.wheelDiameterIn);
  out.push(dim(sb[0] + sb[2], gy1, sb[0] + sb[2], gy0, 8, `WHEEL Ø ${f2(metrics.wheelDiameterIn)}`, th));
  const [, cy1] = sd.tx(0, -metrics.groundClearanceIn);
  out.push(dim(sb[0], cy1, sb[0], gy0, -6, `CLEARANCE ${f2(metrics.groundClearanceIn)}`, th, 2.2));
  const lab = (x: number, y: number, s2: string) => `<text x="${f2(x)}" y="${f2(y)}" font-size="2.8" font-weight="700" fill="${th.text}" text-anchor="middle" font-family="Inter, Arial">${s2}</text>`;
  out.push(lab(tb[0] + tb[2] / 2, tb[1] + tb[3] + 18, 'TOP'), lab(sb[0] + sb[2] / 2, sb[1] + sb[3] + 16, 'SIDE'));
  // gear train table
  const dt = spec.drivetrain;
  const rows: string[][] = [['DRIVE', `${dt.type.toUpperCase()} · ${dt.motors.count} × ${dt.motors.type}${dt.motors.cartridge ? ` ${dt.motors.cartridge.toUpperCase()}` : ''}`], ['WHEELS', `${dt.wheelsPerSide * 2} × ${dt.wheel.diameterIn}″ ${dt.wheel.kind.toUpperCase()} (${dt.wheelMount})`], ['GEARING', dt.gearing ? `${dt.gearing.driving}T : ${dt.gearing.driven}T — CENTRES ${((dt.gearing.driving + dt.gearing.driven) / 48).toFixed(2)} IN` : 'DIRECT DRIVE'], ['WHEEL RPM', `${metrics.wheelRpm}`], ['TOP SPEED', `${metrics.topSpeedInPerS.toFixed(2)} IN/S (${metrics.topSpeedFtPerS.toFixed(2)} FT/S)`], ['PUSH (THEOR. STALL)', `${metrics.pushLbf.toFixed(1)} LBF`], ['TRAVEL / MOTOR REV', `${metrics.wheelTravelPerMotorRevMm.toFixed(2)} MM`]];
  const gx = W - 10 - 180 + 2, gy = 20;
  out.push(`<text x="${gx}" y="${gy}" font-size="3" font-weight="800" fill="${th.text}" font-family="Inter, Arial">DRIVETRAIN DATA</text>`);
  rows.forEach(([a, b], i) => out.push(`<text x="${gx}" y="${gy + 7 + i * 5.5}" font-size="2.3" font-weight="700" fill="${th.text}" font-family="Inter, Arial">${esc(a)}</text><text x="${gx + 50}" y="${gy + 7 + i * 5.5}" font-size="2.3" fill="${th.text}" font-family="Inter, Arial">${esc(b)}</text>`));
  out.push(titleBlock(W, H, th, info, 'Drivetrain', '02', sheetOf, l, 'INCHES', '±0.03 in'));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">${out.join('')}</svg>`;
}

export function subsystemsSheet(spec: RobotSpec, parts: PartInstance[], metrics: Metrics, info: SheetInfo, themeName: ThemeName = 'blueprint', sheetOf = '3 of 3') {
  const th = THEMES[themeName];
  const W = 431.8, H = 279.4;
  const out: string[] = [frame(W, H, th)];
  const maxParts = generate(spec, { pose: 1 }).parts;
  const side = projectView(parts, 'right', { ghosts: true });
  const sideMax = projectView(maxParts.filter((p) => p.subsystemId !== 'drivetrain' && p.subsystemId !== 'electronics'), 'right', { ghosts: true });
  const both: ViewResult = { shapes: [], min: [Math.min(side.min[0], sideMax.min[0]), Math.min(side.min[1], sideMax.min[1])], max: [Math.max(side.max[0], sideMax.max[0]), Math.max(side.max[1], sideMax.max[1])] };
  const w = (both.max[0] - both.min[0]) * IN, h = (both.max[1] - both.min[1]) * IN;
  const { s, l } = pickScale((k) => w * k + 50 <= 215 && h * k + 50 <= 220);
  const f = fitTx(both, [35, 25, w * s, h * s], s * IN);
  // phantom max pose first (dash-dot), then the start pose
  for (const sh of sideMax.shapes) {
    const d = sh.pts.map((p, i) => { const [x, y] = f.tx(p[0], p[1]); return `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`; }).join('') + 'Z';
    out.push(`<path d="${d}" fill="none" stroke="${th.dim}" stroke-width="0.2" stroke-dasharray="3 0.8 0.6 0.8"/>`);
  }
  out.push(viewSvg(side, f.tx, th));
  const fb = f.bbox;
  const [, g0] = f.tx(0, 0), [, mh] = f.tx(0, -metrics.maxHeight), [, sh] = f.tx(0, -metrics.startSize.height);
  out.push(dim(fb[0] + fb[2], mh, fb[0] + fb[2], g0, 10, `MAX HEIGHT ${f2(metrics.maxHeight)}`, th));
  out.push(dim(fb[0], sh, fb[0], g0, -8, `START ${f2(metrics.startSize.height)}`, th));
  const lift = spec.subsystems.find((x) => x.type === 'lift');
  const notes: string[] = [];
  if (lift && lift.type === 'lift') {
    const [, py] = f.tx(0, -(lift.towerHeightIn - 0.75));
    out.push(dim(fb[0] - 14, py, fb[0] - 14, g0, -4, `PIVOT ${f2(lift.towerHeightIn - 0.75)}`, th, 2.2));
    notes.push(`LIFT (${lift.variant.toUpperCase()}): TOWER ${f2(lift.towerHeightIn)} · ARM ${f2(lift.armLengthIn)} · SWEEP ${lift.maxAngleDeg ?? 100}°`, `LIFT DRIVE: ${lift.motors.map((m) => `${m.count} × ${m.type}${m.cartridge ? ` ${m.cartridge}` : ''}`).join(', ')}${lift.gearing ? ` · ${lift.gearing.driving}:${lift.gearing.driven}` : ''} · ${lift.rubberBands} RUBBER BANDS`);
  }
  for (const sub of spec.subsystems) {
    if (sub.type === 'intake') notes.push(`INTAKE: ${sub.stages}-STAGE ${sub.variant.toUpperCase()} · ${sub.rollerCount} × ${sub.rollerDiameterIn}″ ROLLERS · WIDTH ${f2(sub.widthIn)} · ${sub.position.toUpperCase()}`);
    else if (sub.type === 'clamp') notes.push(`CLAMP: ${sub.variant.toUpperCase()} (${sub.position.toUpperCase()})`);
    else if (sub.type === 'launcher') notes.push(`LAUNCHER: ${sub.variant.toUpperCase()}${sub.status === 'planned' ? ' — PLANNED' : ''}`);
    else if (sub.type !== 'lift') notes.push(`${sub.type.toUpperCase()}: ${sub.name}`);
  }
  notes.push('PHANTOM (DASH-DOT) = MAX POSE · DASHED = PLANNED');
  const gx = W - 10 - 180 + 2;
  out.push(`<text x="${gx}" y="22" font-size="3" font-weight="800" fill="${th.text}" font-family="Inter, Arial">SUBSYSTEM GEOMETRY</text>`);
  notes.forEach((n, i) => out.push(`<text x="${gx}" y="${30 + i * 5.2}" font-size="2.2" fill="${th.text}" font-family="Inter, Arial">${esc(n)}</text>`));
  out.push(`<text x="${fb[0] + fb[2] / 2}" y="${fb[1] + fb[3] + 18}" font-size="2.8" font-weight="700" text-anchor="middle" fill="${th.text}" font-family="Inter, Arial">SIDE — START + MAX POSE</text>`);
  out.push(titleBlock(W, H, th, info, 'Subsystems', '03', sheetOf, l, 'INCHES', '±0.03 in'));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">${out.join('')}</svg>`;
}

/** printed-part sheet (ANSI A) from a triangle mesh in mm */
export function printedPartSheet(mesh: { positions: number[]; indices: number[] }, part: { name: string; template: string; material: string; color: string; describe: string; legality: string; filename: string; sha: string; params: Record<string, unknown>; holes?: string }, info: SheetInfo, sheetNo: string, sheetOf: string, themeName: ThemeName = 'blueprint') {
  const th = THEMES[themeName];
  const W = 279.4, H = 215.9;
  const out: string[] = [frame(W, H, th)];
  const P = mesh.positions, I = mesh.indices;
  const views: { name: string; u: number[]; w: number[]; d: number[] }[] = [
    { name: 'TOP', u: [1, 0, 0], w: [0, -1, 0], d: [0, 0, 1] },
    { name: 'FRONT', u: [1, 0, 0], w: [0, 0, -1], d: [0, -1, 0] },
    { name: 'RIGHT', u: [0, 1, 0], w: [0, 0, -1], d: [1, 0, 0] },
    { name: 'ISO', u: [0.7071, -0.7071, 0], w: [-0.4082, -0.4082, -0.8165], d: [0.577, 0.577, 0.577] },
  ];
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], P[i + k]); max[k] = Math.max(max[k], P[i + k]); }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const { s, l } = pickScale((k) => (size[0] + size[1]) * k + 60 <= 150 && (size[1] + size[2]) * k + 50 <= 150);
  const slots = [[30, 30], [30, 30 + size[1] * s + 22], [30 + size[0] * s + 28, 30 + size[1] * s + 22], [30 + size[0] * s + 28, 26]];
  views.forEach((vw, vi) => {
    const tris: { d: number; pts: number[][]; n: number[] }[] = [];
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const nl = Math.hypot(n[0], n[1], n[2]) || 1;
      const nn = n.map((x) => x / nl);
      if (nn[0] * vw.d[0] + nn[1] * vw.d[1] + nn[2] * vw.d[2] <= 1e-6) continue;
      const pts = [a, b, c].map((q) => [(P[q] - min[0]) * vw.u[0] + (P[q + 1] - min[1]) * vw.u[1] + (P[q + 2] - min[2]) * vw.u[2], (P[q] - min[0]) * vw.w[0] + (P[q + 1] - min[1]) * vw.w[1] + (P[q + 2] - min[2]) * vw.w[2]]);
      const d = [a, b, c].reduce((acc, q) => acc + P[q] * vw.d[0] + P[q + 1] * vw.d[1] + P[q + 2] * vw.d[2], 0);
      tris.push({ d, pts, n: nn });
    }
    tris.sort((x, y) => x.d - y.d);
    let x0 = Infinity, y0 = Infinity;
    for (const tr of tris) for (const p of tr.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); }
    const sc = vi === 3 ? s * 0.75 : s;
    const [ox, oy] = slots[vi];
    const g: string[] = [];
    const light = [-0.4, -0.5, 0.75];
    for (const tr of tris) {
      const shade = themeName === 'paper' ? 1 : 0.85 + 0.15 * Math.max(0, tr.n[0] * light[0] + tr.n[1] * light[1] + tr.n[2] * light[2]);
      const d = tr.pts.map((p, i) => `${i ? 'L' : 'M'}${(ox + (p[0] - x0) * sc).toFixed(2)} ${(oy + (p[1] - y0) * sc).toFixed(2)}`).join('') + 'Z';
      g.push(`<path d="${d}" fill="${th.fill}" fill-opacity="${shade.toFixed(2)}" stroke="${th.line}" stroke-width="0.04" stroke-opacity="0.35"/>`);
    }
    out.push(`<g>${g.join('')}</g>`);
    out.push(`<text x="${ox}" y="${oy - 3}" font-size="2.6" font-weight="700" fill="${th.text}" font-family="Inter, Arial">${vw.name}</text>`);
    if (vi === 0) {
      out.push(dim(ox, oy + size[1] * s, ox + size[0] * s, oy + size[1] * s, 6, `${size[0].toFixed(1)} [${(size[0] / IN).toFixed(2)}]`, th, 2.2));
      out.push(dim(ox, oy, ox, oy + size[1] * s, -6, `${size[1].toFixed(1)} [${(size[1] / IN).toFixed(2)}]`, th, 2.2));
    }
    if (vi === 1) out.push(dim(ox + size[0] * s, oy, ox + size[0] * s, oy + size[2] * s, 6, `${size[2].toFixed(1)} [${(size[2] / IN).toFixed(2)}]`, th, 2.2));
  });
  const gx = W - 10 - 180 + 2;
  const lines = [
    `PART: ${part.name} (${part.template})`, part.describe, `MATERIAL: ${part.material} ${part.color}`,
    `PARAMETERS: ${Object.entries(part.params).map(([k, v]) => `${k}=${v}`).join(', ')}`.slice(0, 110),
    part.holes ?? 'HOLES: Ø4.4 THRU, 12.7 PITCH (8-32 CLEARANCE, +0.2 MM COMPENSATION)',
    'PRINT THIS FACE DOWN: LARGEST FLAT FACE · 0.2 MM LAYERS · 3 WALLS',
    `LEGALITY: ${part.legality}`,
    'IN V5RC, 3D-PRINTED PARTS ARE ONLY LEGAL AS NON-FUNCTIONAL DECORATIONS OR LICENSE PLATES.',
    `STL: ${part.filename} · SHA-256 ${part.sha.slice(0, 8)}`,
  ];
  lines.forEach((t, i) => out.push(`<text x="${gx}" y="${H - 10 - 50 - 6 - (lines.length - i) * 4.3}" font-size="${i === 0 ? 2.6 : 2}" font-weight="${i === 0 ? 700 : 400}" fill="${th.text}" font-family="Inter, Arial">${esc(t)}</text>`));
  out.push(titleBlock(W, H, th, info, `Printed part: ${part.name}`, sheetNo, sheetOf, l, 'MM [IN]', '±0.2 mm'));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm">${out.join('')}</svg>`;
}

/** dashboard thumbnail: A = large iso left, front top-right, side bottom-right; B = strip front · iso · side */
export function thumbnailSvg(parts: PartInstance[], layout: 'a' | 'b', label?: string) {
  const th = layout === 'a' ? THEMES.blueprint : THEMES.navy;
  const W = layout === 'a' ? 235 : 286, H = layout === 'a' ? 130 : 73;
  const out: string[] = [`<rect width="${W}" height="${H}" fill="${th.bg}"/>`];
  const gs = layout === 'a' ? 10 : 9;
  out.push(`<defs><pattern id="tg${layout}" width="${gs}" height="${gs}" patternUnits="userSpaceOnUse"><path d="M${gs} 0H0V${gs}" fill="none" stroke="${th.grid}" stroke-width="1"/></pattern></defs><rect width="${W}" height="${H}" fill="url(#tg${layout})"/>`);
  out.push(`<rect x="3.5" y="3.5" width="${W - 7}" height="${H - 7}" fill="none" stroke="${th.line}" stroke-opacity="0.6" stroke-width="1"/>`);
  const iso = projectView(parts, 'iso'), front = projectView(parts, 'front'), side = projectView(parts, 'right');
  const place = (vr: ViewResult, box: [number, number, number, number], sw: number) => { const f = fitTx(vr, box); out.push(viewSvg(vr, f.tx, th, sw)); };
  if (layout === 'a') {
    out.push(`<line x1="146" y1="8" x2="146" y2="122" stroke="${th.line}" stroke-opacity="0.35"/><line x1="146" y1="65" x2="227" y2="65" stroke="${th.line}" stroke-opacity="0.35"/>`);
    place(iso, [10, 16, 130, 106], 0.6);
    place(front, [154, 10, 66, 50], 0.5);
    place(side, [152, 70, 70, 50], 0.5);
    out.push(`<text x="9" y="14" font-size="6" font-weight="600" letter-spacing="0.7" fill="${th.text}" fill-opacity="0.85" font-family="Inter, Arial">ASSEMBLY — ISO</text>`);
  } else {
    place(front, [10, 8, 68, 56], 0.45);
    place(iso, [88, 6, 92, 61], 0.45);
    place(side, [186, 8, 78, 48], 0.45);
    out.push(`<path d="M214 57H281M214 57V66" stroke="${th.line}" stroke-opacity="0.55" fill="none"/><text x="217" y="63.5" font-size="5.5" letter-spacing="0.4" fill="${th.text}" font-family="Inter, Arial">${esc((label ?? '').toUpperCase().slice(0, 18))}</text>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${out.join('')}</svg>`;
}
