import { NextResponse, type NextRequest } from 'next/server';

/**
 * 1. www → apex: when NEXT_PUBLIC_SITE_URL is e.g. https://cozystyle.pk, requests for
 *    www.cozystyle.pk are permanently redirected there (one canonical host for SEO and cookies).
 *    No-op on other hosts (staging subdomains, localhost).
 * 2. Lightweight gate for /admin — presence check only. The signed cookie is cryptographically
 *    verified (against the DB) in `src/app/admin/(panel)/layout.tsx` via getCurrentAdmin().
 */
const SESSION_COOKIE = 'iw_admin_session';

const CANONICAL_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null;
  } catch {
    return null;
  }
})();

export function middleware(request: NextRequest) {
  const host = (request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '').split(',')[0].trim();
  if (CANONICAL_HOST && host === `www.${CANONICAL_HOST}`) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(`https://${CANONICAL_HOST}${pathname}${search}`, 308);
  }

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
  // Everything except Next's own assets (those carry hashed names and are host-agnostic).
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
