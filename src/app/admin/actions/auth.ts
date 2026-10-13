'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { clearSessionCookie, getCurrentAdmin, setSessionCookie } from '@/lib/auth';

export type LoginState = { error: string | null };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Please enter your email and password.' };
  }

  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) {
    return { error: 'Invalid email or password' };
  }

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) {
    return { error: 'Invalid email or password' };
  }

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
