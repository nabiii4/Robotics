import { NextResponse, type NextRequest } from 'next/server';

// Exposes the pathname to server layouts (used for the first-sign-in password redirect).
export function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set('x-pathname', req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}
export const config = { matcher: ['/((?!api|_next|brand|favicon).*)'] };
