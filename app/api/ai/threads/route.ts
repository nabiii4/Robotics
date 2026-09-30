import { route } from '@/lib/api';
import { listThreads } from '@/lib/ai/mentor';
export const runtime = 'nodejs';
export const GET = route({}, async ({ user }) => ({ threads: (await listThreads(user.id)).map((t) => ({ ...t, updatedAt: t.updatedAt.getTime() })) }));
