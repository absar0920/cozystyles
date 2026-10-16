import type { Metadata } from 'next';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { prisma } from '@/lib/db';
import { startOfStoreDay, storeRangeStart } from '@/lib/dates';
import { sweepOrphanUploads } from '@/lib/uploads';
import { AdminPageHeader } from '@/components/admin/ui';
import { ChatIcon, ExternalLinkIcon, ImageIcon, ImagesIcon } from '@/components/admin/icons';
import { CheckIcon, CubeIcon, EditIcon, FilterIcon, MailIcon, PlusIcon, TruckIcon, UserIcon } from '@/components/icons';
import { InquiryList } from './inquiries/_components/InquiryList';
import { INQUIRY_SELECT, topProducts, withSources } from './inquiries/_lib/inquiries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard',
  robots: { index: false, follow: false },
};

type Icon = ComponentType<{ className?: string }>;

function StatCard({
  label,
  value,
  sub,
  href,
  icon: Icon,
  iconClass,
  testId,
}: {
  label: string;
  value: string;
  sub: string;
  href: string;
  icon: Icon;
  iconClass: string;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className="mt-1.5 truncate font-heading text-2xl font-bold text-ink-dark">{value}</p>
        </div>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="mt-2 text-xs text-gray-400">{sub}</p>
    </Link>
  );
}

function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-heading text-sm font-bold text-ink-dark">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex min-h-10 items-center text-xs font-semibold text-brand hover:underline">
          {linkLabel ?? 'See all →'}
        </Link>
      )}
    </div>
  );
}

const n = (v: number) => v.toLocaleString('en-PK');

export default async function AdminDashboardPage() {
  // Removed uploads that nothing uses any more are cleaned up in the background (throttled to hourly in the lib).
  void sweepOrphanUploads().catch(() => undefined);

  const since30 = storeRangeStart(30);
  const [
    today,
    last7,
    last30,
    availability30,
    published,
    drafts,
    noPhotos,
    soldOut,
    collections,
    newMessages,
    top,
    recent,
  ] = await Promise.all([
    prisma.whatsAppInquiry.count({ where: { createdAt: { gte: startOfStoreDay() } } }),
    prisma.whatsAppInquiry.count({ where: { createdAt: { gte: storeRangeStart(7) } } }),
    prisma.whatsAppInquiry.count({ where: { createdAt: { gte: since30 } } }),
    prisma.whatsAppInquiry.count({ where: { createdAt: { gte: since30 }, kind: 'AVAILABILITY' } }),
    prisma.product.count({ where: { status: 'ACTIVE' } }),
    prisma.product.count({ where: { status: 'DRAFT' } }),
    prisma.product.count({ where: { images: { none: {} } } }),
    prisma.product.count({ where: { variants: { some: {}, every: { status: 'SOLD_OUT' } } } }),
    prisma.collection.count(),
    prisma.contactSubmission.count({ where: { status: 'NEW' } }),
    topProducts({ createdAt: { gte: since30 } }, 10),
    prisma.whatsAppInquiry.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8, select: INQUIRY_SELECT }),
  ]);
  const recentViews = await withSources(recent);
  const availabilityShare = last30 > 0 ? Math.round((availability30 / last30) * 100) : 0;

  const quickLinks: { label: string; href: string; icon: Icon; primary?: boolean }[] = [
    { label: 'Add product', href: '/admin/products/new', icon: PlusIcon, primary: true },
    { label: 'Home banners', href: '/admin/banners', icon: ImagesIcon },
    { label: 'Menus', href: '/admin/menus', icon: FilterIcon },
    { label: 'Settings', href: '/admin/settings', icon: UserIcon },
  ];

  return (
    <div>
      <AdminPageHeader title="Dashboard" subtitle="WhatsApp inquiries and your catalogue at a glance." />

      {/* ---------- Row 1: WhatsApp inquiries ---------- */}
      <SectionTitle title="WhatsApp clicks" href="/admin/inquiries" linkLabel="All inquiries →" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          testId="stat-inquiries-today"
          label="Today"
          value={n(today)}
          sub="Since midnight"
          href="/admin/inquiries?range=1"
          icon={ChatIcon}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Last 7 days"
          value={n(last7)}
          sub="Including today"
          href="/admin/inquiries?range=7"
          icon={ChatIcon}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Last 30 days"
          value={n(last30)}
          sub="Including today"
          href="/admin/inquiries?range=30"
          icon={ChatIcon}
          iconClass="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          label="Availability questions"
          value={`${availabilityShare}%`}
          sub={`${n(availability30)} of ${n(last30)} clicks in 30 days`}
          href="/admin/inquiries?range=30&kind=AVAILABILITY"
          icon={TruckIcon}
          iconClass="bg-amber-50 text-amber-600"
        />
      </div>

      {/* ---------- Row 2: catalogue overview ---------- */}
      <div className="mt-6">
        <SectionTitle title="Catalogue" href="/admin/products" linkLabel="All products →" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Published"
            value={n(published)}
            sub="Visible on the store"
            href="/admin/products?status=published"
            icon={CheckIcon}
            iconClass="bg-brand-50 text-brand-600"
          />
          <StatCard
            label="Drafts"
            value={n(drafts)}
            sub="Hidden until published"
            href="/admin/products?status=draft"
            icon={EditIcon}
            iconClass="bg-gray-100 text-gray-600"
          />
          <StatCard
            label="No photos"
            value={n(noPhotos)}
            sub="Products without a photo"
            href="/admin/products?photos=missing"
            icon={ImageIcon}
            iconClass="bg-indigo-50 text-indigo-600"
          />
          <StatCard
            label="Sold out"
            value={n(soldOut)}
            sub="Every option sold out"
            href="/admin/products?availability=soldout"
            icon={CubeIcon}
            iconClass="bg-red-50 text-red-500"
          />
          <StatCard
            label="Collections"
            value={n(collections)}
            sub="Groups of products"
            href="/admin/collections"
            icon={FilterIcon}
            iconClass="bg-cyan-50 text-cyan-600"
          />
          <StatCard
            label="New messages"
            value={n(newMessages)}
            sub={newMessages > 0 ? 'Unread contact messages' : 'All read'}
            href="/admin/messages?status=NEW"
            icon={MailIcon}
            iconClass="bg-rose-50 text-rose-500"
          />
        </div>
      </div>

      {/* ---------- Quick links ---------- */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-heading text-sm font-bold text-ink-dark">Quick links</h2>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
          {quickLinks.map(({ label, href, icon: Icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition sm:px-4 ${
                primary ? 'bg-brand text-white hover:bg-brand-600' : 'border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" /> {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ---------- Most asked-about products ---------- */}
      <div className="mt-6" data-testid="top-products">
        <SectionTitle title="Most asked-about products · last 30 days" />
        {top.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-8 text-center text-sm text-gray-500">
            No product inquiries in the last 30 days yet.
          </div>
        ) : (
          <ol className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {top.map((t, i) => (
              <li key={t.productId} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <span className="w-5 shrink-0 text-right text-xs font-semibold text-gray-400">{i + 1}</span>
                {t.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-gray-100 object-cover" />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                )}
                <Link
                  href={`/admin/products/${t.productId}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium text-ink-dark hover:text-brand hover:underline"
                >
                  {t.title}
                </Link>
                <span className="shrink-0 text-xs font-semibold text-gray-600">
                  {n(t.clicks)} {t.clicks === 1 ? 'click' : 'clicks'}
                </span>
                <a
                  href={`/products/${t.handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand hover:bg-brand-50"
                  aria-label={`View “${t.title}” on the store`}
                >
                  View <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ---------- Recent inquiries ---------- */}
      <div className="mt-6">
        <SectionTitle title="Recent inquiries" href="/admin/inquiries" />
        <InquiryList rows={recentViews} emptyMessage="When customers tap Order on WhatsApp, it shows up here." />
      </div>
    </div>
  );
}
