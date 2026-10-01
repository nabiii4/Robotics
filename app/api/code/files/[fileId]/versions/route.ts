import { desc, eq } from 'drizzle-orm';
import { route } from '@/lib/api';
import { db, schema } from '@/lib/db/client';

export const runtime = 'nodejs';

export const GET = route<{ fileId: string }>({}, async ({ params }) => {
  const rows = await db.select().from(schema.codeVersions).where(eq(schema.codeVersions.fileId, params.fileId)).orderBy(desc(schema.codeVersions.createdAt)).limit(100);
  const users = await db.select({ id: schema.users.id, displayName: schema.users.displayName }).from(schema.users);
  return { versions: rows.map((v) => ({ id: v.id, content: v.content, message: v.message, author: users.find((u) => u.id === v.authorId)?.displayName ?? 'Generator', createdAt: v.createdAt.getTime() })) };
});
