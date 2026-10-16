import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AdminUser } from '@prisma/client';
import { getCurrentAdmin } from '@/lib/auth';
import { safeAdminNext } from '@/lib/admin-login';

/** The sign-in page, coming back to the admin page being viewed (set by src/middleware.ts) after signing in. */
export async function loginUrl(): Promise<string> {
  const next = safeAdminNext((await headers()).get('x-admin-path'));
  return next === '/admin' ? '/admin/login' : `/admin/login?next=${encodeURIComponent(next)}`;
}

/**
 * For server actions and pages: the logged-in admin, or a redirect to the login page.
 * (Before a save is sent, the admin's SessionGuard checks the session and asks the owner to sign in again in
 * place, so an ended session normally never reaches this redirect from an editor.)
 */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect(await loginUrl());
  return admin;
}

/** For route handlers: the logged-in admin or null (the caller answers 401). */
export async function getAdminOrNull(): Promise<AdminUser | null> {
  return getCurrentAdmin();
}
