import { NextResponse, type NextRequest } from 'next/server';
import { VISITOR_COOKIE, VISITOR_MAX_AGE_S, createVisitorToken, verifyVisitorToken } from '@/lib/visitor';

/**
 * 1. Lightweight gate for /admin — presence check only.
 *    The signed cookie is cryptographically verified (against the DB) in
 *    `src/app/admin/(panel)/layout.tsx` via getCurrentAdmin().
 * 2. Storefront pages: give each browser a signed visitor cookie, used to rate-limit
 *    WhatsApp click logging per visitor (see `src/lib/inquiry-limit.ts`).
 */
const SESSION_COOKIE = 'iw_admin_session';
/** The admin page being requested, for the login redirect's ?next= (read in src/lib/admin-guard.ts). */
const ADMIN_PATH_HEADER = 'x-admin-path';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin')) {
    const res = NextResponse.next();
    if (request.method === 'GET' && !(await verifyVisitorToken(request.cookies.get(VISITOR_COOKIE)?.value))) {
      const token = await createVisitorToken();
      if (token) {
        res.cookies.set(VISITOR_COOKIE, token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:',
          path: '/',
          maxAge: VISITOR_MAX_AGE_S,
        });
      }
    }
    return res;
  }

  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLogin = pathname === '/admin/login' || pathname.startsWith('/admin/login/');
  // A server action (a Save) is a POST to the page's own URL. Redirecting it here would make the editor crash
  // ("An unexpected response was received from the server") and lose what was typed; the action checks the
  // session itself, and the admin's session guard asks the owner to sign in again before it is sent.
  const isServerAction = request.method === 'POST' && request.headers.has('next-action');

  if (isAdminArea && !isLogin && !isServerAction && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    // come back here after signing in
    if (pathname !== '/admin') url.searchParams.set('next', pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // lets requireAdmin() send an ended session to /admin/login?next=<this page>
  const headers = new Headers(request.headers);
  headers.set(ADMIN_PATH_HEADER, pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // admin + storefront pages; not API routes, uploads, Next internals or static files
  matcher: ['/admin/:path*', '/((?!api/|uploads/|images/|videos/|fonts/|_next/|admin|.*\\.[a-z0-9]+$).*)'],
};
