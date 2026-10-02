import { route } from '@/lib/api';
import { reserveAll } from '@/lib/services/bomActions';

export const runtime = 'nodejs';
export const POST = route<{ id: string }>({}, async ({ params, user }) => reserveAll(params.id, user));
