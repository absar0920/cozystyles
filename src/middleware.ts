import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight gate for /admin — presence check only.
 * The signed cookie is cryptographically verified (against the DB) in
 * `src/app/admin/(panel)/layout.tsx` via getCurrentAdmin().
 */
const SESSION_COOKIE = 'iw_admin_session';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminArea = pathname === '/admin' || pathname.startsWith('/admin/');
  const isLogin = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

  if (isAdminArea && !isLogin && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = '/admin/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
