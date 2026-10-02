import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { route, publicUser } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';
export const GET = route({}, async ({ user }) => ({ user: publicUser(user) }));

const Body = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  teamRole: z.enum(['Builder', 'Programmer', 'Driver', 'Designer', 'Notebook', 'Captain', 'Coach']).optional(),
  grade: z.string().max(10).nullable().optional(),
  bio: z.string().max(300).nullable().optional(),
  skills: z.array(z.string().max(30)).max(10).optional(),
  prefs: z.object({
    layout: z.enum(['a', 'b', 'auto']).optional(), quality: z.enum(['low', 'medium', 'high']).optional(), reduceMotion: z.boolean().optional(),
    replyLength: z.enum(['concise', 'detailed']).optional(), memoryEnabled: z.boolean().optional(), mentorPanelOpen: z.boolean().optional(), notif: z.record(z.boolean()).optional(),
  }).optional(),
});
export const PATCH = route({ body: Body }, async ({ user, body }) => {
  const { prefs, ...rest } = body;
  await db.update(schema.users).set({ ...rest, ...(prefs ? { prefs: { ...user.prefs, ...prefs } } : {}) }).where(eq(schema.users.id, user.id));
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, user.id) });
  return { user: publicUser(u!) };
});
