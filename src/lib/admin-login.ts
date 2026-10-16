import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { rateLimit, resetRateLimit } from '@/lib/ratelimit';

/** Max failed login attempts per email before throttling kicks in. */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Checks an email + password and, when they match, sets the session cookie. Returns an error message or null.
 * Shared by the login page and the "signed out while editing" sign-in box.
 * Throttled: 5 attempts per email per 10 minutes; a successful login clears the window.
 */
export async function signInWithPassword(emailInput: unknown, passwordInput: unknown): Promise<string | null> {
  const email = String(emailInput ?? '')
    .trim()
    .toLowerCase();
  const password = String(passwordInput ?? '');
  if (!email || !password) return 'Please enter your email and password.';

  const throttleKey = `login:${email}`;
  if (!rateLimit(throttleKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS).ok) return 'Too many attempts, try again later';

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return 'Invalid email or password';

  resetRateLimit(throttleKey);
  await setSessionCookie(admin);
  return null;
}

/**
 * Where to go after signing in: an admin path from `?next=` (never the login page itself, never another site),
 * else the dashboard.
 */
export function safeAdminNext(next: unknown): string {
  const s = typeof next === 'string' ? next : '';
  if (!/^\/admin(?:[/?#]|$)/.test(s) || s.startsWith('//') || s.includes('\\')) return '/admin';
  if (/^\/admin\/login(?:[/?#]|$)/.test(s)) return '/admin';
  return s;
}
