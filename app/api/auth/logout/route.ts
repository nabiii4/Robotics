import { route } from '@/lib/api';
import { destroySession } from '@/lib/auth/session';
export const runtime = 'nodejs';
export const POST = route({ auth: false }, async () => { await destroySession(); return { ok: true }; });
