import 'server-only';
import zlib from 'node:zlib';

// Small deterministic software rasterizer for print thumbnails (3/4 view, filament colour, transparent bg).
const COLORS: Record<string, string> = { black: '#2C2F33', red: '#C8102E', white: '#E8EAED', gray: '#8A9097', grey: '#8A9097', blue: '#1F6FD1', green: '#1FA84F', orange: '#EA8111', yellow: '#F2C200', purple: '#643DBC' };

function hexLin(h: string): [number, number, number] {
  const c = COLORS[h.toLowerCase()] ?? (h.startsWith('#') ? h : '#2C2F33');
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((x) => Math.pow(x, 2.2)) as [number, number, number];
}

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf: Buffer) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type: string, data: Buffer) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
export function encodePng(W: number, H: number, rgba: Buffer): Buffer {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export function renderThumbnail(mesh: { positions: Float32Array; indices: Uint32Array }, color: string, W = 200, H = 150): Buffer {
  const SS = 3, w = W * SS, h = H * SS;
  const az = (-35 * Math.PI) / 180, el = (32 * Math.PI) / 180;
  const c = [Math.sin(az) * Math.cos(el), Math.cos(az) * Math.cos(el), Math.sin(el)];
  const fwd = [-c[0], -c[1], -c[2]];
  let right = [fwd[1] * 1 - fwd[2] * 0, fwd[2] * 0 - fwd[0] * 1, 0];
  const rl = Math.hypot(right[0], right[1], right[2]); right = right.map((x) => x / rl);
  const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const P = mesh.positions, I = mesh.indices;
  const nv = P.length / 3;
  const sx = new Float32Array(nv), sy = new Float32Array(nv), sz = new Float32Array(nv);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < nv; i++) {
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
    sx[i] = px * right[0] + py * right[1] + pz * right[2];
    sy[i] = -(px * up[0] + py * up[1] + pz * up[2]);
    sz[i] = px * fwd[0] + py * fwd[1] + pz * fwd[2];
    x0 = Math.min(x0, sx[i]); x1 = Math.max(x1, sx[i]); y0 = Math.min(y0, sy[i]); y1 = Math.max(y1, sy[i]);
  }
  const f = Math.min((w * 0.82) / Math.max(1e-6, x1 - x0), (h * 0.8) / Math.max(1e-6, y1 - y0));
  const cx = w / 2 - (f * (x0 + x1)) / 2, cy = h / 2 - (f * (y0 + y1)) / 2;
  for (let i = 0; i < nv; i++) { sx[i] = cx + f * sx[i]; sy[i] = cy + f * sy[i]; }
  const depth = new Float32Array(w * h).fill(Infinity);
  const col = new Float32Array(w * h * 3);
  const cov = new Uint8Array(w * h);
  const base = hexLin(color);
  const L1 = [-0.5, 0.55, 0.8], l1 = Math.hypot(L1[0], L1[1], L1[2]); const L = L1.map((x) => x / l1);
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], cc = I[t + 2];
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[cc * 3] - P[a * 3], vy = P[cc * 3 + 1] - P[a * 3 + 1], vz = P[cc * 3 + 2] - P[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if (nx * c[0] + ny * c[1] + nz * c[2] <= 0) continue;
    const d1 = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const hemi = 0.5 + 0.5 * nz;
    const hx = L[0] + c[0], hy = L[1] + c[1], hz = L[2] + c[2], hl = Math.hypot(hx, hy, hz);
    const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hl), 30) * 0.35;
    const shade = base.map((bc) => Math.pow(1 - Math.exp(-(bc * (0.08 + hemi * 0.35 + d1 * 1.2) + spec) * 1.5), 1 / 2.2));
    const ax = sx[a], ay = sy[a], bx = sx[b], by = sy[b], qx = sx[cc], qy = sy[cc];
    const area = (bx - ax) * (qy - ay) - (qx - ax) * (by - ay);
    if (Math.abs(area) < 1e-9) continue;
    const minx = Math.max(0, Math.floor(Math.min(ax, bx, qx))), maxx = Math.min(w - 1, Math.ceil(Math.max(ax, bx, qx)));
    const miny = Math.max(0, Math.floor(Math.min(ay, by, qy))), maxy = Math.min(h - 1, Math.ceil(Math.max(ay, by, qy)));
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((bx - px) * (qy - py) - (qx - px) * (by - py)) / area;
      const w1 = ((qx - px) * (ay - py) - (ax - px) * (qy - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * sz[a] + w1 * sz[b] + w2 * sz[cc];
      const idx = y * w + x;
      if (z >= depth[idx]) continue;
      depth[idx] = z; cov[idx] = 1;
      col[idx * 3] = shade[0]; col[idx * 3 + 1] = shade[1]; col[idx * 3 + 2] = shade[2];
    }
  }
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = 0; yy < SS; yy++) for (let xx = 0; xx < SS; xx++) { const i = (y * SS + yy) * w + x * SS + xx; if (cov[i]) { r += col[i * 3]; g += col[i * 3 + 1]; b += col[i * 3 + 2]; n++; } }
    const o = (y * W + x) * 4;
    if (n) { out[o] = Math.round((r / n) * 255); out[o + 1] = Math.round((g / n) * 255); out[o + 2] = Math.round((b / n) * 255); }
    out[o + 3] = Math.round((n / (SS * SS)) * 255);
  }
  return encodePng(W, H, out);
}
