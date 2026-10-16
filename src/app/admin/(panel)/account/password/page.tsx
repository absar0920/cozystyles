import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/admin-guard';
import { AdminPageHeader, SectionCard } from '@/components/admin/ui';
import { PasswordForm } from './PasswordForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Change password',
  robots: { index: false, follow: false },
};

export default async function ChangePasswordPage() {
  const admin = await requireAdmin();
  return (
    <div className="max-w-xl">
      <AdminPageHeader title="Change password" subtitle={`For ${admin.email}`} />
      <SectionCard
        title="Your password"
        description="After the change you stay signed in on this device; every other phone or computer is signed out."
      >
        <PasswordForm />
      </SectionCard>
    </div>
  );
}
