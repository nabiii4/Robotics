import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { getSetting } from '@/lib/services/settings';

export const runtime = 'nodejs';

export const GET = route({ role: 'admin' }, async () => {
  const t = await db.query.team.findFirst();
  return { team: t ? { name: t.name, school: t.school, teamNumber: t.teamNumber } : null, joinCode: await getSetting<string | null>('team.joinCodePlain', null) };
});

export const PATCH = route({ role: 'admin', body: z.object({ name: z.string().trim().min(1).max(60).optional(), school: z.string().trim().min(1).max(120).optional(), teamNumber: z.string().trim().max(12).nullable().optional() }) }, async ({ body }) => {
  await db.update(schema.team).set({ ...body, teamNumber: body.teamNumber === undefined ? undefined : body.teamNumber || null }).where(eq(schema.team.id, 'team'));
  return { ok: true };
});
