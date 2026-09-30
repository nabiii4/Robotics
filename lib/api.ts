import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { z, ZodError } from 'zod';
import { currentUser, type SessionUser } from './auth/session';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const bad = (message: string, details?: unknown) => new ApiError(400, 'bad_request', message, details);
export const notFound = (what = 'Not found') => new ApiError(404, 'not_found', what);
export const forbidden = (message = 'You do not have permission to do that.') => new ApiError(403, 'forbidden', message);

type Role = 'admin' | 'captain' | 'member';
const RANK: Record<Role, number> = { member: 0, captain: 1, admin: 2 };
export const atLeast = (u: { role: string }, r: Role) => RANK[u.role as Role] >= RANK[r];

export function requireRole(u: { role: string }, r: Role) {
  if (!atLeast(u, r)) throw forbidden();
}

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  try {
    const o = new URL(origin);
    if (o.host === host) return true;
    const app = process.env.APP_URL ? new URL(process.env.APP_URL) : null;
    return !!app && o.host === app.host;
  } catch {
    return false;
  }
}

type Ctx<P> = { params: Promise<P> };
interface Opts<B extends z.ZodTypeAny> { auth?: boolean; role?: Role; body?: B }
type HandlerArgs<B extends z.ZodTypeAny, P> = { req: NextRequest; user: SessionUser; body: z.infer<B>; params: P };

export function route<P = Record<string, string>, B extends z.ZodTypeAny = z.ZodAny>(opts: Opts<B>, fn: (a: HandlerArgs<B, P>) => Promise<unknown>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD' && !sameOrigin(req)) throw new ApiError(403, 'csrf', 'Cross-site request blocked.');
      let user = null as SessionUser | null;
      if (opts.auth !== false) {
        user = await currentUser();
        if (!user) throw new ApiError(401, 'unauthorized', 'Please sign in.');
        if (opts.role) requireRole(user, opts.role);
      }
      let body: unknown = undefined;
      if (opts.body) {
        const json = await req.json().catch(() => { throw bad('Invalid JSON body.'); });
        body = opts.body.parse(json);
      }
      const params = (ctx?.params ? await ctx.params : {}) as P;
      const out = await fn({ req, user: user as SessionUser, body: body as z.infer<B>, params });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: { code: 'validation', message: e.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), details: e.issues } }, { status: 400 });
      console.error('[api]', req.method, req.nextUrl.pathname, (e as Error).message);
      return NextResponse.json({ error: { code: 'server_error', message: 'Something went wrong on the server.' } }, { status: 500 });
    }
  };
}

export const publicUser = (u: SessionUser) => ({
  id: u.id, username: u.username, displayName: u.displayName, avatarText: u.avatarText, avatarColor: u.avatarColor,
  role: u.role, teamRole: u.teamRole, grade: u.grade, bio: u.bio, prefs: u.prefs, mustChangePassword: u.mustChangePassword, skills: u.skills,
});
