import crypto from 'node:crypto';
import { env } from './env';

function key(): Buffer {
  const k = env().APP_ENCRYPTION_KEY;
  if (k) {
    const b = Buffer.from(k, 'base64');
    if (b.length === 32) return b;
    // any other secret string (e.g. a platform-generated value) is stretched to 32 bytes
    return crypto.createHash('sha256').update(k).digest();
  }
  // development fallback: derived from the database URL (set APP_ENCRYPTION_KEY in production)
  return crypto.createHash('sha256').update(`fdrhs-dev:${env().DATABASE_URL}`).digest();
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}

export function decrypt(blob: string | null | undefined): string {
  if (!blob) return '';
  try {
    const [iv, tag, data] = blob.split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}

export const sha256 = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
