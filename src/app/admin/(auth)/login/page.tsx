import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { LoginForm } from '@/components/admin/shell/LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin Login',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  // Already signed in? Go straight to the dashboard.
  const admin = await getCurrentAdmin();
  if (admin) redirect('/admin');

  return (
    <div className="rounded-2xl bg-white p-8 shadow-2xl sm:p-10">
      <div className="mb-8 flex flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo.png" alt="Interwood" className="h-10 w-auto" width={160} height={40} />
        <h1 className="mt-6 font-heading text-lg font-bold text-ink-dark">Admin Panel</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in to manage your store</p>
      </div>

      <LoginForm />

      <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-center text-xs leading-relaxed text-gray-400">
        Seeded credentials: <span className="font-medium text-gray-500">admin@interwood.local</span> ·{' '}
        <span className="font-medium text-gray-500">Interwood@2026</span>
        <br />
        (set via <code className="text-[11px]">ADMIN_EMAIL</code> / <code className="text-[11px]">ADMIN_PASSWORD</code> before seeding)
      </div>
    </div>
  );
}
