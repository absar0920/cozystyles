import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { TOAST_COOKIE, TOAST_COOKIE_PATH, type FlashedToast, type ToastTone } from './toast';

/** For an action on a row that was deleted a moment ago (in another tab or by another device). */
export const ALREADY_REMOVED = 'Already removed (in another tab or on another device)';

function readQueued(value: string | undefined): FlashedToast[] {
  if (!value) return [];
  try {
    const list: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    return Array.isArray(list) ? (list as FlashedToast[]) : [];
  } catch {
    return []; // a malformed (or older-format) cookie is replaced
  }
}

/**
 * From a server action: leave a toast for the browser (shown by <Toaster /> once the action's response has
 * arrived, also after a redirect). Readable by the page script on purpose; it holds only the message text.
 * A toast not yet shown (two actions finishing at once) is kept: the cookie holds a short list, each with an id
 * so the browser never shows the same one twice.
 *
 * The value is base64url: Next.js re-reads a redirecting action's own Set-Cookie header and decodes it once
 * more, which throws on any "%" left after the first decode (a product called "100% Cotton").
 */
export async function flashToast(tone: ToastTone, message: string) {
  const jar = await cookies();
  const queued = readQueued(jar.get(TOAST_COOKIE)?.value).slice(-2);
  const value = Buffer.from(JSON.stringify([...queued, { id: randomUUID(), tone, message }]), 'utf8').toString('base64url');
  jar.set(TOAST_COOKIE, value, { path: TOAST_COOKIE_PATH, maxAge: 30, sameSite: 'lax', httpOnly: false });
}
