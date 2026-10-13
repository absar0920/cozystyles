import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/admin/shell/Sidebar';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/admin/login');

  // Badge counts for the sidebar.
  const [pendingOrders, newMessages] = await Promise.all([
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.contactSubmission.count({ where: { status: 'NEW' } }),
  ]);

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar
        adminName={admin.name}
        adminEmail={admin.email}
        pendingOrders={pendingOrders}
        newMessages={newMessages}
      />
      <main className="pt-16 lg:pt-0 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
