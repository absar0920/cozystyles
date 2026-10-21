import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-guard';
import { prisma } from '@/lib/db';
import { ensureDefaultLayout } from '@/lib/default-layout';
import { startOfStoreDay } from '@/lib/dates';
import { getWhatsAppConfig } from '@/lib/whatsapp-server';
import { Sidebar } from '@/components/admin/shell/Sidebar';
import { Notice } from '@/components/admin/ui';
import { SessionGuard } from '@/components/admin/SessionGuard';

export const dynamic = 'force-dynamic';

// the sticky save bar pads itself with env(safe-area-inset-bottom)
export const viewport: Viewport = { viewportFit: 'cover' };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  await ensureDefaultLayout();

  // Badge counts for the sidebar + the store-wide WhatsApp warning.
  const [inquiriesToday, newMessages, whatsapp] = await Promise.all([
    prisma.whatsAppInquiry.count({ where: { createdAt: { gte: startOfStoreDay() } } }),
    prisma.contactSubmission.count({ where: { status: 'NEW' } }),
    getWhatsAppConfig(),
  ]);

  return (
    <div className="min-h-screen bg-gray-100">
      <SessionGuard email={admin.email} />
      <Sidebar adminName={admin.name} adminEmail={admin.email} inquiriesToday={inquiriesToday} newMessages={newMessages} />
      <main className="pt-16 lg:pt-0 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {!whatsapp && (
            <div className="mb-6">
              <Notice
                tone="warning"
                title="WhatsApp ordering is off"
                action={
                  <Link
                    href="/admin/settings#whatsapp"
                    className="inline-flex min-h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    Go to Settings
                  </Link>
                }
              >
                Add your WhatsApp number in Settings — until then the Order on WhatsApp buttons are hidden on the store.
              </Notice>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
