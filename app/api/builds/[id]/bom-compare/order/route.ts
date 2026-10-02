import { route } from '@/lib/api';
import { orderShortages } from '@/lib/services/bomActions';

export const runtime = 'nodejs';
export const POST = route<{ id: string }>({}, async ({ params, user }) => orderShortages(params.id, user));
