import type { NextRequest } from 'next/server';

/** Same-origin check against the public host (X-Forwarded-Host when behind a proxy, else Host). */
export function isSameOriginRequest(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const publicHost = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '').split(',')[0].trim().toLowerCase();
  if (origin) {
    try {
      return !!publicHost && new URL(origin).host.toLowerCase() === publicHost;
    } catch {
      return false;
    }
  }
  return req.headers.get('sec-fetch-site') === 'same-origin';
}
