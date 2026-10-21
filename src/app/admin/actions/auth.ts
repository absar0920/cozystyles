'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { clearSessionCookie, getCurrentAdmin, setSessionCookie } from '@/lib/auth';
import { rateLimit, resetRateLimit } from '@/lib/ratelimit';

export type LoginState = { error: string | null };

/** Max failed login attempts per email before throttling kicks in. */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Please enter your email and password.' };
  }

  // Throttle brute-force attempts: 5 failures per email per 10 minutes.
  // Counted per attempt; a successful login clears the window.
  const throttleKey = `login:${email}`;
  const rl = rateLimit(throttleKey, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
  if (!rl.ok) {
    return { error: 'Too many attempts, try again later' };
  }

  const admin = (await prisma.adminUser.findUnique({ where: { email } })) ?? (await bootstrapFirstAdmin(email, password));
  if (!admin) {
    return { error: 'Invalid email or password' };
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return { error: 'Invalid email or password' };
  }

  resetRateLimit(throttleKey);
  await setSessionCookie(admin.id);
  redirect('/admin');
}

/**
 * First sign-in on an empty database: if no admin exists yet and the credentials match
 * ADMIN_EMAIL / ADMIN_PASSWORD from the server environment, create that admin. This lets a fresh
 * deployment (e.g. Hostinger, no shell needed) be set up entirely from the browser. Once any admin
 * exists this never runs again.
 */
async function bootstrapFirstAdmin(email: string, password: string) {
  const envEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envEmail || !envPassword || envPassword.length < 8) return null;
  if (email !== envEmail || password !== envPassword) return null;
  if ((await prisma.adminUser.count()) > 0) return null;
  return prisma.adminUser.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10), name: 'Interwood Admin', role: 'SUPERADMIN' },
  });
}

export async function logoutAction() {
  const admin = await getCurrentAdmin();
  if (admin) {
    await clearSessionCookie();
  }
  redirect('/admin/login');
}
