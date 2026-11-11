import { NextResponse, type NextRequest } from 'next/server';

/**
 * 1. Fast redirect for signed-out visitors to /app and /admin. This only checks
 *    that a session cookie exists; the real session validation happens
 *    server-side in the app layout.
 * 2. Partner links (?ref=CODE): remember the code for 60 days so the sign-up
 *    can be credited to the partner. The first partner wins.
 */
const REF_RE = /^[a-z0-9]{6,12}$/;

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isProtected = pathname === '/app' || pathname.startsWith('/app/') || pathname === '/admin' || pathname.startsWith('/admin/');
  if (isProtected && !(req.cookies.has('__Host-pg_session') || req.cookies.has('pg_session'))) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  const ref = req.nextUrl.searchParams.get('ref')?.trim().toLowerCase();
  if (ref && REF_RE.test(ref) && !req.cookies.has('pg_ref')) {
    res.cookies.set('pg_ref', ref, { httpOnly: true, sameSite: 'lax', secure: (process.env.APP_URL ?? '').startsWith('https://'), path: '/', maxAge: 60 * 24 * 3600 });
  }
  return res;
}

export const config = { matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'] };
