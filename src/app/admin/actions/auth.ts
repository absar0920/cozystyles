'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { clearSessionCookie, getCurrentAdmin, setSessionCookie } from '@/lib/auth';
import { safeAdminNext, signInWithPassword } from '@/lib/admin-login';
import { rateLimit, resetRateLimit } from '@/lib/ratelimit';
import { requireAdmin } from '@/lib/admin-guard';

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const error = await signInWithPassword(formData.get('email'), formData.get('password'));
  if (error) return { error };
  // back to the page the admin was on when the session ran out (?next=), else the dashboard
  redirect(safeAdminNext(formData.get('next')));
}

export async function logoutAction() {
  const admin = await getCurrentAdmin();
  if (admin) {
    await clearSessionCookie();
  }
  redirect('/admin/login');
}

export type ChangePasswordState = {
  ok: boolean;
  error: string | null;
  /** which field the error belongs to */
  field?: 'current' | 'next' | 'confirm';
};

const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 200; // bcrypt only uses the first 72 bytes; this just bounds the work
const PASSWORD_MAX_ATTEMPTS = 5;
const PASSWORD_WINDOW_MS = 10 * 60 * 1000;

/**
 * Change the logged-in admin's password (SPEC §5.9). Bumps `sessionVersion`, which logs out every other
 * device, then re-issues this browser's cookie so the admin stays signed in here.
 */
export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const admin = await requireAdmin();
  const current = String(formData.get('currentPassword') ?? '');
  const next = String(formData.get('newPassword') ?? '');
  const confirm = String(formData.get('confirmPassword') ?? '');

  if (!current) return { ok: false, field: 'current', error: 'Please enter your current password.' };
  if (!next) return { ok: false, field: 'next', error: 'Please choose a new password.' };

  const throttleKey = `pw:${admin.id}`;
  if (!rateLimit(throttleKey, PASSWORD_MAX_ATTEMPTS, PASSWORD_WINDOW_MS).ok) {
    return { ok: false, error: 'Too many attempts. Please wait 10 minutes and try again.' };
  }

  if (!(await bcrypt.compare(current, admin.passwordHash))) {
    return { ok: false, field: 'current', error: 'Your current password is not correct.' };
  }
  if (next.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, field: 'next', error: `The new password must be at least ${PASSWORD_MIN_LENGTH} characters.` };
  }
  if (next.length > PASSWORD_MAX_LENGTH) {
    return { ok: false, field: 'next', error: `The new password can be at most ${PASSWORD_MAX_LENGTH} characters.` };
  }
  if (next === current) {
    return { ok: false, field: 'next', error: 'The new password must be different from your current one.' };
  }
  if (next !== confirm) {
    return { ok: false, field: 'confirm', error: 'The two new passwords do not match.' };
  }

  const passwordHash = await bcrypt.hash(next, 12);
  const updated = await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash, sessionVersion: { increment: 1 } },
    select: { id: true, sessionVersion: true },
  });
  await setSessionCookie(updated);
  resetRateLimit(throttleKey);
  return { ok: true, error: null };
}
