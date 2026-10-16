import { Logo } from '@/components/brand/Logo';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { LoginForm } from '@/components/admin/shell/LoginForm';
import { safeAdminNext } from '@/lib/admin-login';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  // ?next= : the admin page to return to (the session ran out while it was open)
  const raw = (await searchParams).next;
  const next = safeAdminNext(Array.isArray(raw) ? raw[0] : raw);
  // Already signed in? Go straight on.
  const admin = await getCurrentAdmin();
  if (admin) redirect(next);

  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl sm:p-10">
      <div className="mb-8 flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Logo size="md" withTagline />
        <h1 className="mt-6 font-heading text-lg font-bold text-ink-dark">Admin Panel</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to manage your store</p>
      </div>

      {next !== '/admin' && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">
          You were signed out. Sign in again to go back to the page you were on.
        </p>
      )}
      <LoginForm next={next} />
    </div>
  );
}
