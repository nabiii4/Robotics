'use client';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { AL_THICK } from '@/lib/robot/catalog';

const cache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry) {
  let g = cache.get(key);
  if (!g) { g = make(); cache.set(key, g); }
  return g;
}

/** box whose UVs are in hole units (0.5″), so the hole texture lands on the real grid */
function holeBox(w: number, h: number, d: number, cx = 0, cy = 0, cz = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(cx, cy, cz);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const nor = g.attributes.normal as THREE.BufferAttribute;
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const x0 = cx - w / 2, y0 = cy - h / 2, z0 = cz - d / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - x0, y = pos.getY(i) - y0, z = pos.getZ(i) - z0;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (nx > 0.5) uv.setXY(i, z / 0.5, y / 0.5);
    else if (ny > 0.5) uv.setXY(i, x / 0.5, z / 0.5);
    else uv.setXY(i, x / 0.5, y / 0.5);
  }
  uv.needsUpdate = true;
  return g;
}

/** C-channel 1xNx1: web at y=0 (width N×0.5 along x), flanges 0.5″ toward +y, length along z */
export function channelGeometry(n: number, holes: number) {
  return cached(`ch:${n}:${holes}`, () => {
    const w = n * 0.5, L = holes * 0.5, t = AL_THICK;
    return mergeGeometries([
      holeBox(w, t, L, 0, t / 2, 0),
      holeBox(t, 0.5, L, -w / 2 + t / 2, 0.25, 0),
      holeBox(t, 0.5, L, w / 2 - t / 2, 0.25, 0),
    ])!;
  });
}
export function angleGeometry(holes: number) {
  return cached(`ang:${holes}`, () => {
    const L = holes * 0.5, t = AL_THICK;
    return mergeGeometries([holeBox(1, t, L, 0, t / 2, 0), holeBox(t, 1, L, -0.5 + t / 2, 0.5, 0)])!;
  });
}
export function plateGeometry(w: number, t: number, l: number) {
  return cached(`pl:${w}:${t}:${l}`, () => holeBox(w, t, l));
}
export function boxGeometry(x: number, y: number, z: number) {
  return cached(`box:${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
}
export function roundedBox(x: number, y: number, z: number, r = 0.12) {
  return cached(`rbox:${x}:${y}:${z}:${r}`, () => new RoundedBoxGeometry(x, y, z, 3, r));
}
/** cylinder whose axis is local X */
export function cylX(r: number, len: number, seg = 32) {
  return cached(`cx:${r}:${len}:${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2));
}
export function cylY(r: number, len: number, seg = 24) {
  return cached(`cy:${r}:${len}:${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg));
}
export function cylZ(r: number, len: number, seg = 24) {
  return cached(`cz:${r}:${len}:${seg}`, () => new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2));
}

/** gear with correct N, pitch Ø N/24″, addendum 1/24″, dedendum 1.25/24″ and a square bore; axis local X */
export function gearGeometry(teeth: number, face: number, bore = 0.25) {
  return cached(`gear:${teeth}:${face}`, () => {
    const pd = teeth / 24, ro = pd / 2 + 1 / 24, rr = pd / 2 - 1.25 / 24;
    const p = (2 * Math.PI) / teeth;
    const shape = new THREE.Shape();
    for (let t = 0; t < teeth; t++) {
      const b = t * p;
      const pts: [number, number][] = [[rr, -0.5], [rr, -0.3], [ro, -0.14], [ro, 0.14], [rr, 0.3]];
      pts.forEach(([r, f], i) => { const a = b + f * p; if (t === 0 && i === 0) shape.moveTo(r * Math.cos(a), r * Math.sin(a)); else shape.lineTo(r * Math.cos(a), r * Math.sin(a)); });
    }
    shape.closePath();
    const hb = bore / 2 + 0.01;
    const hole = new THREE.Path();
    hole.moveTo(-hb, -hb); hole.lineTo(hb, -hb); hole.lineTo(hb, hb); hole.lineTo(-hb, hb); hole.closePath();
    shape.holes.push(hole);
    if (teeth >= 48) {
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4, rc = pd * 0.28, rh = pd * 0.1;
        const c = new THREE.Path();
        c.absarc(rc * Math.cos(a), rc * Math.sin(a), rh, 0, Math.PI * 2, true);
        shape.holes.push(c);
      }
    }
    const g = new THREE.ExtrudeGeometry(shape, { depth: face, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -face / 2);
    g.rotateY(Math.PI / 2);
    return g;
  });
}

/** wheel pieces (axis local X): hub + tread/rollers */
export function wheelGeometry(kind: string, d: number, w: number, hand = 'A'): { hub: THREE.BufferGeometry; tread: THREE.BufferGeometry } {
  return {
    hub: cached(`wh-hub:${kind}:${d}:${w}`, () => {
      if (kind === 'omni') return mergeGeometries([cylX(d * 0.36, 0.08, 36).clone().translate(-w * 0.28, 0, 0), cylX(d * 0.36, 0.08, 36).clone().translate(w * 0.28, 0, 0), cylX(0.32, w * 0.7, 20).clone()])!;
      if (kind === 'mecanum') return mergeGeometries([cylX(d * 0.39, 0.1, 40).clone().translate(-w / 2 + 0.05, 0, 0), cylX(d * 0.39, 0.1, 40).clone().translate(w / 2 - 0.05, 0, 0), cylX(0.35, w * 0.8, 20).clone()])!;
      return mergeGeometries([cylX(d * 0.34, w * 0.92, 36).clone()])!;
    }),
    tread: cached(`wh-tread:${kind}:${d}:${w}:${hand}`, () => {
      const r = d / 2;
      if (kind === 'omni') {
        const n = Math.max(8, Math.round(d * 3));
        const rollers: THREE.BufferGeometry[] = [];
        const rl = (2 * Math.PI * (r - 0.1)) / n * 0.8;
        for (const [ring, off] of [[0, -w * 0.18], [1, w * 0.18]] as const) {
          for (let k = 0; k < n; k++) {
            const a = ((k + ring * 0.5) / n) * Math.PI * 2;
            const cap = new THREE.CapsuleGeometry(0.13 * (d / 3.25), rl, 3, 10);
            cap.rotateX(Math.PI / 2);
            cap.rotateX(-a);
            cap.translate(off, Math.cos(a) * (r - 0.14), -Math.sin(a) * (r - 0.14));
            rollers.push(cap);
          }
        }
        return mergeGeometries(rollers)!;
      }
      if (kind === 'mecanum') {
        const n = 10;
        const rollers: THREE.BufferGeometry[] = [];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const cap = new THREE.CapsuleGeometry(0.2 * (d / 4), w * 0.9, 3, 12);
          cap.rotateX(Math.PI / 2); // along z
          cap.rotateY((hand === 'A' ? 1 : -1) * Math.PI / 4);
          cap.rotateX(-a);
          cap.translate(0, Math.cos(a) * (r - 0.22), -Math.sin(a) * (r - 0.22));
          rollers.push(cap);
        }
        return mergeGeometries(rollers)!;
      }
      const tire = new THREE.TorusGeometry(r - w * 0.28, w * 0.3, 14, 48);
      tire.scale(1, 1, w / (w * 0.6) * 0.95);
      tire.rotateY(Math.PI / 2);
      return tire;
    }),
  };
}

/** flex-wheel roller: segments along local X */
export function rollerGeometry(d: number, len: number) {
  return cached(`roller:${d}:${len}`, () => {
    const seg = 0.9, gap = 0.1;
    const n = Math.max(1, Math.floor(len / (seg + gap)));
    const used = n * (seg + gap) - gap;
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.CylinderGeometry(d / 2, d / 2, seg, 28, 1).rotateZ(Math.PI / 2);
      g.translate(-used / 2 + seg / 2 + i * (seg + gap), 0, 0);
      parts.push(g);
    }
    return mergeGeometries(parts)!;
  });
}

let holeTex: THREE.Texture | null = null;
/** 64×64: opaque white with a centred 23.3 px transparent square (0.182/0.5 × 64) */
export function holeAlphaTexture() {
  if (holeTex) return holeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#000';
  const s = (0.182 / 0.5) * 64;
  ctx.fillRect(32 - s / 2, 32 - s / 2, s, s);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  holeTex = t;
  return t;
}

const textTex = new Map<string, THREE.Texture>();
export function labelTexture(text: string, opts: { bg: string; fg: string; w?: number; h?: number; font?: string; sub?: string }) {
  const key = `${text}|${opts.sub}|${opts.bg}|${opts.fg}`;
  const hit = textTex.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = opts.w ?? 256; c.height = opts.h ?? 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = opts.bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = opts.fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = opts.font ?? `900 ${Math.round(c.height * 0.55)}px Arial, sans-serif`;
  ctx.fillText(text, c.width / 2, opts.sub ? c.height * 0.4 : c.height / 2);
  if (opts.sub) { ctx.font = `600 ${Math.round(c.height * 0.14)}px Arial, sans-serif`; ctx.fillStyle = '#9AA3AD'; ctx.fillText(opts.sub.slice(0, 26), c.width / 2, c.height * 0.72); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  textTex.set(key, t);
  return t;
}
