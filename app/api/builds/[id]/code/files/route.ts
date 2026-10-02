import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { route, notFound, bad } from '@/lib/api';
import { db, schema } from '@/lib/db/client';
import { newId } from '@/lib/ids';
import { validPath } from '@/lib/services/code';

export const runtime = 'nodejs';

const Body = z.object({ path: z.string().trim().min(3).max(80), content: z.string().max(200 * 1024).optional() });

export const POST = route<{ id: string }, typeof Body>({ body: Body }, async ({ params, body, user }) => {
  const b = await db.query.builds.findFirst({ where: eq(schema.builds.id, params.id) });
  if (!b || b.deletedAt) throw notFound('That build doesn’t exist.');
  if (!validPath(body.path)) throw bad('Use a name like src/arm.cpp or include/arm.h (letters, numbers, - and _).');
  const dup = await db.query.codeFiles.findFirst({ where: and(eq(schema.codeFiles.buildId, b.id), eq(schema.codeFiles.path, body.path)) });
  if (dup) throw bad('A file with that name already exists.');
  const id = newId();
  const now = new Date();
  const name = body.path.split('/').pop()!;
  const content = body.content ?? (name.endsWith('.h') ? `// FDRHS Robotics - ${name}\n#pragma once\n#include "vex.h"\n\n` : `// FDRHS Robotics - ${name}\n#include "vex.h"\n\nusing namespace vex;\n\n`);
  await db.insert(schema.codeFiles).values({ id, buildId: b.id, path: body.path, content, generated: false, updatedBy: user.id, updatedAt: now });
  await db.insert(schema.codeVersions).values({ id: newId(), fileId: id, content, authorId: user.id, message: 'created', createdAt: now });
  return { id };
});
