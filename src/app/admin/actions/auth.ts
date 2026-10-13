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

  const admin = await prisma.adminUser.findUnique({ where: { email } });
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

export async function logoutAction() {
  const admin = await getCurrentAdmin();
  if (admin) {
    await clearSessionCookie();
  }
  redirect('/admin/login');
}
