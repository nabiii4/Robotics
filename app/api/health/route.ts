import { sql } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Liveness check for hosting platforms (no sign-in needed). */
export const GET = route({ auth: false }, async () => {
  await db.run(sql`select 1`);
  return { ok: true };
});
