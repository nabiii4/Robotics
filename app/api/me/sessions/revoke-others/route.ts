import { and, eq, ne } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { currentSession } from '@/lib/auth/session';
export const runtime = 'nodejs';
export const POST = route({}, async ({ user }) => {
  const s = await currentSession();
  await db.delete(schema.sessions).where(and(eq(schema.sessions.userId, user.id), ne(schema.sessions.id, s!.session.id)));
  return { ok: true };
});
