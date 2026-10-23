import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';
import { rateLimit, resetRateLimit } from '@/lib/ratelimit';

/** Shortest admin password: the same rule for Change password and the first-sign-in ADMIN_PASSWORD. */
export const ADMIN_PASSWORD_MIN_LENGTH = 10;

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

  const admin = (await prisma.adminUser.findUnique({ where: { email } })) ?? (await bootstrapFirstAdmin(email, password));
  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return 'Invalid email or password';

  resetRateLimit(throttleKey);
  await setSessionCookie(admin);
  return null;
}

/**
 * First sign-in on an empty database: when no admin exists yet and the credentials match ADMIN_EMAIL /
 * ADMIN_PASSWORD from the server environment, create that admin. A fresh deployment (Hostinger, no shell) is then
 * set up from the browser alone. Once any admin exists this never runs again.
 */
async function bootstrapFirstAdmin(email: string, password: string) {
  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envEmail || !envPassword || envPassword.length < ADMIN_PASSWORD_MIN_LENGTH) return null;
  if (email !== envEmail || password !== envPassword) return null;
  if ((await prisma.adminUser.count()) > 0) return null;
  return prisma.adminUser.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10), name: 'Store Admin', role: 'SUPERADMIN' },
  });
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
