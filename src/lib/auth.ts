import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import type { AdminUser } from '@prisma/client';

const COOKIE_NAME = 'iw_admin_session';
const MAX_AGE_S = 60 * 60 * 12; // 12h

// Fail fast at module load: without a real secret anyone could forge admin
// session cookies, so a hard-coded fallback is never acceptable.
const providedSecret = process.env.SESSION_SECRET;
if (!providedSecret) {
  throw new Error('SESSION_SECRET is required');
}
const SESSION_SECRET: string = providedSecret;

function secret(): string {
  return SESSION_SECRET;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSessionToken(adminId: number): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = `${adminId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [idStr, expStr, sig] = parts;
  const payload = `${idStr}.${expStr}`;
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return null;
  const id = Number(idStr);
  return Number.isFinite(id) ? id : null;
}

export async function setSessionCookie(adminId: number) {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionToken(adminId), {
    httpOnly: true,
    sameSite: 'lax',
    // Secure cookies require HTTPS. Plain-HTTP VPS deployments must opt in
    // explicitly (COOKIE_SECURE=1); otherwise the browser would silently drop
    // the cookie and login would appear broken.
    secure: process.env.COOKIE_SECURE === '1',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Returns the logged-in admin (validating the session against the DB) or null. */
export async function getCurrentAdmin(): Promise<AdminUser | null> {
  const store = await cookies();
  const id = verifySessionToken(store.get(COOKIE_NAME)?.value);
  if (id == null) return null;
  return prisma.adminUser.findUnique({ where: { id } });
}
