import { asc } from 'drizzle-orm';
import { route, atLeast } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

export const GET = route({}, async ({ user }) => {
  const rows = await db.select().from(schema.users).orderBy(asc(schema.users.displayName));
  const admin = atLeast(user, 'admin');
  return {
    members: rows.filter((u) => admin || !u.disabled).map((u) => ({
      id: u.id, username: u.username, displayName: u.displayName, avatarText: u.avatarText, avatarColor: u.avatarColor, role: u.role, teamRole: u.teamRole, grade: u.grade, bio: u.bio,
      skills: u.skills, lastActiveAt: u.lastActiveAt?.getTime() ?? null, disabled: u.disabled, createdAt: u.createdAt.getTime(),
    })),
  };
});
