import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { sha256 } from '@/lib/crypto';
import { setSetting } from '@/lib/services/settings';

export const runtime = 'nodejs';

/** Rotate the team join code; the old one stops working immediately. */
export const POST = route({ role: 'admin' }, async () => {
  const code = `COUGAR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  await db.update(schema.team).set({ joinCodeHash: sha256(code) }).where(eq(schema.team.id, 'team'));
  await setSetting('team.joinCodePlain', code);
  return { joinCode: code };
});
