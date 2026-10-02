// Injected into the service-worker bundle: node's Buffer for the server code.
import { Buffer } from 'buffer';

// the npm "buffer" package predates node's base64url encoding
type Enc = Parameters<typeof Buffer.prototype.toString>[0];
const toStr = Buffer.prototype.toString;
Buffer.prototype.toString = function (this: Buffer, enc?: string, start?: number, end?: number) {
  if (enc === 'base64url') return toStr.call(this, 'base64', start, end).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return toStr.call(this, enc as Enc, start, end);
} as typeof toStr;
const from = Buffer.from;
Buffer.from = function (value: unknown, enc?: unknown, len?: unknown) {
  if (typeof value === 'string' && enc === 'base64url') return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  return (from as (...a: unknown[]) => Buffer).call(Buffer, value, enc, len);
} as typeof from;
const isEnc = Buffer.isEncoding;
Buffer.isEncoding = (enc: string) => enc === 'base64url' || isEnc(enc);

(globalThis as unknown as { Buffer?: typeof Buffer }).Buffer ??= Buffer;
export { Buffer };
