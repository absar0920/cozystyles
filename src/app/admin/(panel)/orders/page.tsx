import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { formatPKR } from '@/lib/money';
import { ORDER_STATUSES, PAYMENT_METHODS } from '@/lib/constants';
import { AdminPageHeader, AdminTable, Badge, EmptyRow } from '@/components/admin/ui';
import { ChevronLeft, ChevronRight, SearchIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Orders',
  robots: { index: false, follow: false },
};

const PER_PAGE = 20;

/** Compact labels for the table; the detail page shows the full method names. */
const SHORT_PAYMENT: Record<string, string> = {
  COD: 'COD',
  CARD: 'Card',
  BANK_TRANSFER: 'Bank Transfer',
  INSTALLMENTS: 'Installments',
};

const paymentLabel = (value: string) => SHORT_PAYMENT[value] ?? PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (d: Date) => new Date(d).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const status =
    typeof sp.status === 'string' && (ORDER_STATUSES as readonly string[]).includes(sp.status) ? sp.status : '';
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);
  const deleted = typeof sp.deleted === 'string' ? sp.deleted : '';

  const search: Prisma.OrderWhereInput[] = q
    ? [
        { orderNumber: { contains: q } },
        { phone: { contains: q } },
        { customerName: { contains: q } },
        { email: { contains: q } },
        { city: { contains: q } },
      ]
    : [];

  const where: Prisma.OrderWhereInput = {};
  if (status) where.status = status;
  if (search.length > 0) where.OR = search;

  // Chips reflect the current search, independent of the active status filter.
  const countWhere: Prisma.OrderWhereInput = search.length > 0 ? { OR: search } : {};

  const [total, grouped, items] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.groupBy({ by: ['status'], where: countWhere, _count: { _all: true } }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { items: { select: { quantity: true } } },
    }),
  ]);

  const countFor = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const allCount = grouped.reduce((n, g) => n + g._count._all, 0);
  const revenueOnPage = items.reduce((n, o) => n + o.total, 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  /** Build a URL preserving current filters with optional overrides (null clears a param). */
  const href = (over: Record<string, string | number | null> = {}) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | null> = { q, status, page, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v === null || v === undefined || v === '') continue;
      if (k === 'page' && Number(v) === 1) continue;
      p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `/admin/orders?${s}` : '/admin/orders';
  };

  const chips: { label: string; value: string; count: number }[] = [
    { label: 'All', value: '', count: allCount },
    ...ORDER_STATUSES.map((s) => ({ label: s.charAt(0) + s.slice(1).toLowerCase(), value: s, count: countFor(s) })),
  ];

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        subtitle="Every order placed on the storefront — click an order to manage it"
        actions={
          <form action="/admin/orders" method="get" className="flex items-center gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search order #, name, phone…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Search
            </button>
          </form>
        }
      />

      {deleted && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Order {deleted} was permanently deleted.
        </div>
      )}

      {/* ---------- Status filter chips ---------- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((c) => {
          const active = status === c.value;
          return (
            <Link
              key={c.label}
              href={href({ status: c.value || null, page: null })}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                active ? 'bg-brand-900 text-white' : 'border border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {c.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {c.count}
              </span>
            </Link>
          );
        })}
      </div>

      <AdminTable head={['Order #', 'Date', 'Customer', 'City', 'Items', 'Total', 'Payment', 'Status', '']}>
        {items.length === 0 ? (
          <EmptyRow colSpan={9} message={q || status ? 'No orders match your filters.' : 'No orders yet — they appear here as soon as a customer checks out.'} />
        ) : (
          items.map((o) => {
            const qty = o.items.reduce((n, i) => n + i.quantity, 0);
            return (
              <tr key={o.id} className="transition hover:bg-gray-50/70">
                <td className="whitespace-nowrap px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-heading text-sm font-bold text-brand-700 hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="block text-ink">{fmtDate(o.createdAt)}</span>
                  <span className="block text-xs text-gray-400">{fmtTime(o.createdAt)}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="block font-medium text-ink-dark">{o.customerName}</span>
                  <a href={`tel:${o.phone}`} className="block text-xs text-gray-400 hover:text-brand">
                    {o.phone}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink">
                  {o.city}
                  <span className="block text-xs text-gray-400">{o.province}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink">
                  <span className="font-semibold">{o.items.length}</span>
                  <span className="text-xs text-gray-400"> · {qty} pcs</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="font-heading font-bold text-ink-dark">{formatPKR(o.total)}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink">{paymentLabel(o.paymentMethod)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <Badge>{o.status}</Badge>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link href={`/admin/orders/${o.id}`} className={ghostBtn}>
                    View
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })
        )}
      </AdminTable>

      {/* ---------- Pagination ---------- */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {page} of {pages} · {total.toLocaleString('en-PK')} order{total === 1 ? '' : 's'} ·{' '}
            {formatPKR(revenueOnPage)} on this page
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className={ghostBtn}>
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Link>
            ) : (
              <span className={`${ghostBtn} cursor-not-allowed opacity-40`}>
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </span>
            )}
            {page < pages ? (
              <Link href={href({ page: page + 1 })} className={ghostBtn}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className={`${ghostBtn} cursor-not-allowed opacity-40`}>
                Next <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
