import { NextResponse, type NextRequest } from 'next/server';
import { getAdminOrNull } from '@/lib/admin-guard';
import { signInWithPassword } from '@/lib/admin-login';
import { isSameOriginRequest } from '@/lib/same-origin';

/**
 * For the admin's SessionGuard (src/components/admin/SessionGuard.tsx):
 *   GET  → { signedIn } — checked before every save is sent, so an ended session never loses the owner's edits.
 *   POST { email, password } → { ok, error? } — signs in again without leaving the editor.
 * A route handler (not a server action) so it is never itself held back by the guard.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  const admin = await getAdminOrNull();
  return NextResponse.json({ signedIn: !!admin }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Blocked for security reasons. Please reload the page.' }, { status: 403, headers: NO_STORE });
  }
  let body: { email?: unknown; password?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // empty / not JSON: answered as missing fields below
  }
  const error = await signInWithPassword(body.email, body.password);
  return NextResponse.json(error ? { ok: false, error } : { ok: true }, { headers: NO_STORE });
}
