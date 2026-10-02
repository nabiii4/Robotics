// node:crypto subset used by the server code (sha256, random bytes, AES-256-GCM), backed by @noble.
import { Buffer } from 'buffer';
import { sha256 } from '@noble/hashes/sha2.js';
import { gcm } from '@noble/ciphers/aes.js';

type Enc = 'hex' | 'base64' | 'base64url' | 'utf8' | 'latin1';
const bytes = (d: string | Uint8Array, enc: Enc = 'utf8') => (typeof d === 'string' ? Buffer.from(d, enc) : d);

export function randomBytes(n: number) {
  const b = Buffer.alloc(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}
export const randomUUID = () => globalThis.crypto.randomUUID();
export function randomInt(min: number, max?: number) {
  if (max === undefined) { max = min; min = 0; }
  return min + Math.floor((randomBytes(4).readUInt32BE(0) / 2 ** 32) * (max - min));
}

export function createHash(alg: string) {
  if (alg !== 'sha256') throw new Error(`Hash ${alg} isn't available in the browser version.`);
  const h = sha256.create();
  const api = {
    update(d: string | Uint8Array, enc?: Enc) { h.update(bytes(d, enc)); return api; },
    digest(enc?: Enc) { const out = Buffer.from(h.digest()); return enc ? out.toString(enc) : out; },
  };
  return api;
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) throw new RangeError('Input buffers must have the same byte length');
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// GCM needs the whole message, so update() buffers and final() does the work
function gcmStream(decrypt: boolean, key: Uint8Array, iv: Uint8Array) {
  const parts: Uint8Array[] = [];
  let tag: Uint8Array | null = null;
  const api = {
    update(d: string | Uint8Array, enc?: Enc) { parts.push(bytes(d, enc)); return Buffer.alloc(0); },
    final() {
      const all = Buffer.concat(parts);
      const c = gcm(key, iv);
      if (decrypt) {
        if (!tag) throw new Error('Missing auth tag');
        return Buffer.from(c.decrypt(Buffer.concat([all, tag])));
      }
      const out = c.encrypt(all);
      tag = out.slice(out.length - 16);
      return Buffer.from(out.slice(0, out.length - 16));
    },
    getAuthTag() { if (!tag) throw new Error('Call final() first'); return Buffer.from(tag); },
    setAuthTag(t: Uint8Array) { tag = t; return api; },
  };
  return api;
}
export function createCipheriv(alg: string, key: Uint8Array, iv: Uint8Array) {
  if (alg !== 'aes-256-gcm') throw new Error(`Cipher ${alg} isn't available in the browser version.`);
  return gcmStream(false, key, iv);
}
export function createDecipheriv(alg: string, key: Uint8Array, iv: Uint8Array) {
  if (alg !== 'aes-256-gcm') throw new Error(`Cipher ${alg} isn't available in the browser version.`);
  return gcmStream(true, key, iv);
}

const crypto = { randomBytes, randomUUID, randomInt, createHash, timingSafeEqual, createCipheriv, createDecipheriv };
export default crypto;
