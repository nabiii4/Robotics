import { route } from '@/lib/api';
import { compareForBuild } from '@/lib/services/bomActions';

export const runtime = 'nodejs';
export const GET = route<{ id: string }>({}, async ({ params, user }) => ({ rows: (await compareForBuild(params.id, user)).rows }));
