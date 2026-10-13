import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatPKR } from '@/lib/money';
import { AdminPageHeader, AdminTable, Badge, EmptyRow } from '@/components/admin/ui';
import {
  CheckIcon,
  CubeIcon,
  HeartIcon,
  MailIcon,
  PackageIcon,
  PlusIcon,
  TruckIcon,
} from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

function StatCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string;
  sub: string;
  href?: string;
  icon: typeof PackageIcon;
  iconClass: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-2 truncate font-heading text-2xl font-bold text-ink-dark">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-3 text-xs text-gray-400">{sub}</p>
    </>
  );

  return href ? (
    <Link
      href={href}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">{body}</div>
  );
}

export default async function AdminDashboardPage() {
  const [totalOrders, revenueAgg, productCount, activeProducts, pendingOrders, newMessages, recentOrders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: 'CANCELLED' } } }),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'ACTIVE' } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.contactSubmission.count({ where: { status: 'NEW' } }),
      prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
    ]);

  const revenue = revenueAgg._sum.total ?? 0;

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        subtitle="Store overview — orders, catalog and customer messages at a glance"
        actions={
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            View Storefront
          </Link>
        }
      />

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total Orders"
          value={totalOrders.toLocaleString('en-PK')}
          sub="All time"
          href="/admin/orders"
          icon={PackageIcon}
          iconClass="bg-brand-50 text-brand-600"
        />
        <StatCard
          label="Revenue"
          value={formatPKR(revenue)}
          sub="Excludes cancelled orders"
          href="/admin/orders"
          icon={CheckIcon}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Products"
          value={productCount.toLocaleString('en-PK')}
          sub={`${activeProducts.toLocaleString('en-PK')} active`}
          href="/admin/products"
          icon={CubeIcon}
          iconClass="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          label="Pending Orders"
          value={pendingOrders.toLocaleString('en-PK')}
          sub={pendingOrders > 0 ? 'Awaiting confirmation' : 'All caught up'}
          href="/admin/orders?status=PENDING"
          icon={TruckIcon}
          iconClass="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="New Messages"
          value={newMessages.toLocaleString('en-PK')}
          sub={newMessages > 0 ? 'Unread contact enquiries' : 'No unread enquiries'}
          href="/admin/messages?status=NEW"
          icon={MailIcon}
          iconClass="bg-red-50 text-red-500"
        />
      </div>

      {/* ---------- Quick actions ---------- */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-heading text-sm font-bold text-ink-dark">Quick Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <PlusIcon className="h-4 w-4" /> New Product
          </Link>
          <Link
            href="/admin/banners#add"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-950"
          >
            <HeartIcon className="h-4 w-4" /> New Banner
          </Link>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            <PackageIcon className="h-4 w-4" /> Manage Orders
          </Link>
          <Link
            href="/admin/messages"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            <MailIcon className="h-4 w-4" /> View Messages
          </Link>
        </div>
      </div>

      {/* ---------- Recent orders ---------- */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-sm font-bold text-ink-dark">Recent Orders</h2>
          <Link href="/admin/orders" className="text-xs font-semibold text-brand hover:underline">
            View all →
          </Link>
        </div>
        <AdminTable head={['Order #', 'Customer', 'Total', 'Status', 'Date']}>
          {recentOrders.length === 0 ? (
            <EmptyRow colSpan={5} message="No orders yet — they will appear here as customers check out." />
          ) : (
            recentOrders.map((o) => (
              <tr key={o.id} className="transition hover:bg-gray-50/70">
                <td className="px-4 py-3 font-heading font-bold text-ink-dark">{o.orderNumber}</td>
                <td className="px-4 py-3">
                  <span className="font-medium text-ink-dark">{o.customerName}</span>
                  <span className="block text-xs text-gray-400">
                    {o.city}
                    {o.email ? ` · ${o.email}` : ''}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-ink-dark">{formatPKR(o.total)}</td>
                <td className="px-4 py-3">
                  <Badge>{o.status}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">{fmtDate(o.createdAt)}</td>
              </tr>
            ))
          )}
        </AdminTable>
      </div>
    </div>
  );
}
