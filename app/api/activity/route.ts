import { route } from '@/lib/api';
import { recentActivity } from '@/lib/services/activity';

export const runtime = 'nodejs';

export const GET = route({}, async ({ req, user }) => {
  const q = req.nextUrl.searchParams;
  const limit = Math.min(50, Number(q.get('limit') ?? 25) || 25);
  const items = await recentActivity(user.id, { limit, before: q.get('before') ? Number(q.get('before')) : undefined, type: q.get('type') || undefined, actorId: q.get('actor') || undefined });
  return { items, next: items.length === limit ? items[items.length - 1].createdAt : null };
});
