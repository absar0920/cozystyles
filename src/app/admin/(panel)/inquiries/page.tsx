import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { startOfStoreDay, storeRangeStart } from '@/lib/dates';
import { AdminPageHeader, Select } from '@/components/admin/ui';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { InquiryList } from './_components/InquiryList';
import { INQUIRY_KIND_LABEL, INQUIRY_KINDS, INQUIRY_SELECT, isInquiryKind, topProducts, withSources } from './_lib/inquiries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'WhatsApp inquiries',
  robots: { index: false, follow: false },
};

const PER_PAGE = 50;

/** URL contract (SPEC §7.5): ?range=1|7|30|90|all&kind=all|ORDER|AVAILABILITY|GENERAL|TRACK&q=…&product=<id>&page=n */
const RANGES = [
  { value: '1', label: 'Today' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
] as const;
type RangeValue = (typeof RANGES)[number]['value'];

const ghostBtn =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-600 transition hover:bg-gray-50';

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const range: RangeValue = RANGES.some((r) => r.value === str('range')) ? (str('range') as RangeValue) : '30';
  const kind = isInquiryKind(str('kind')) ? str('kind') : 'all';
  const q = str('q').trim().slice(0, 100);
  const page = Math.max(1, Number.parseInt(str('page') || '1', 10) || 1);
  // ?product=<id> (from "Most asked-about"): matches by product, so renamed products keep their history
  const productId = /^\d+$/.test(str('product')) ? Number(str('product')) : null;
  const productFilter = productId
    ? await prisma.product.findUnique({ where: { id: productId }, select: { id: true, title: true } })
    : null;

  // Every filter except the date range; the summary's "today" count uses these too.
  const base: Prisma.WhatsAppInquiryWhereInput = {};
  if (kind !== 'all') base.kind = kind;
  if (q) base.productTitle = { contains: q };
  if (productId) base.productId = productId;
  const where: Prisma.WhatsAppInquiryWhereInput =
    range === 'all' ? base : { ...base, createdAt: { gte: storeRangeStart(Number(range)) } };

  const [total, today, top, rows] = await Promise.all([
    prisma.whatsAppInquiry.count({ where }),
    prisma.whatsAppInquiry.count({ where: { ...base, createdAt: { gte: startOfStoreDay() } } }),
    topProducts(where, 5),
    prisma.whatsAppInquiry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: INQUIRY_SELECT,
    }),
  ]);
  const views = await withSources(rows);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const rangeLabel = RANGES.find((r) => r.value === range)!.label;
  const filtered = kind !== 'all' || q !== '' || productId != null;

  const href = (over: Record<string, string | number | null> = {}) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | null> = { range, kind, q, product: productId, page, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v === null || v === '') continue;
      if (k === 'page' && Number(v) === 1) continue;
      if (k === 'range' && v === '30') continue;
      if (k === 'kind' && v === 'all') continue;
      p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `/admin/inquiries?${s}` : '/admin/inquiries';
  };

  return (
    <div>
      <AdminPageHeader
        title="WhatsApp inquiries"
        subtitle="Every tap on an Order on WhatsApp or chat button on your store."
      />

      {/* ---------- Filters (plain GET form: works without JavaScript) ---------- */}
      <form
        action="/admin/inquiries"
        method="get"
        className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end"
      >
        {productId && <input type="hidden" name="product" value={productId} />}
        {productId && (
          <p className="col-span-2 flex flex-wrap items-center gap-2 text-sm text-gray-700 lg:col-span-4" data-testid="inquiries-product-filter">
            Showing inquiries about <strong className="font-semibold text-ink-dark">{productFilter?.title ?? 'a deleted product'}</strong>
            <Link href={href({ product: null, page: null })} className="text-xs font-semibold text-brand hover:underline">
              Show all products
            </Link>
          </p>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Period</span>
          <Select name="range" defaultValue={range} className="min-h-10">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Type</span>
          <Select name="kind" defaultValue={kind} className="min-h-10">
            <option value="all">All types</option>
            {INQUIRY_KINDS.map((k) => (
              <option key={k} value={k}>
                {INQUIRY_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </label>
        <label className="col-span-2 block lg:col-span-1">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Product name</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="e.g. Alexa"
            className="min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <div className="col-span-2 flex gap-2 lg:col-span-1">
          <button
            type="submit"
            className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-600 lg:flex-none"
          >
            Show
          </button>
          {(filtered || range !== '30') && (
            <Link href="/admin/inquiries" className={`${ghostBtn} justify-center px-4 text-sm`}>
              Clear
            </Link>
          )}
        </div>
      </form>

      {/* ---------- Summary ---------- */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_2fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{rangeLabel}</p>
          <p className="mt-1 font-heading text-2xl font-bold text-ink-dark" data-testid="inquiries-total">
            {total.toLocaleString('en-PK')}
          </p>
          <p className="text-xs text-gray-400">{total === 1 ? 'inquiry' : 'inquiries'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Today</p>
          <p className="mt-1 font-heading text-2xl font-bold text-ink-dark">{today.toLocaleString('en-PK')}</p>
          <p className="text-xs text-gray-400">since midnight</p>
        </div>
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:col-span-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Most asked-about · {rangeLabel.toLowerCase()}</p>
          {top.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">No product inquiries yet.</p>
          ) : (
            <ol className="mt-2 space-y-1 text-sm">
              {top.map((t, i) => (
                <li key={t.productId} className="flex min-w-0 items-baseline gap-2">
                  <span className="w-4 shrink-0 text-xs text-gray-400">{i + 1}.</span>
                  <Link
                    href={href({ product: t.productId, q: null, page: null })}
                    className="min-w-0 truncate font-medium text-ink-dark hover:text-brand hover:underline"
                    title={`Show inquiries about ${t.title}`}
                  >
                    {t.title}
                  </Link>
                  <span className="ml-auto shrink-0 text-xs text-gray-500">
                    {t.clicks} {t.clicks === 1 ? 'click' : 'clicks'}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <InquiryList
        rows={views}
        emptyMessage={
          filtered || range !== 'all'
            ? 'No inquiries match these filters. When customers tap Order on WhatsApp, it shows up here.'
            : 'When customers tap Order on WhatsApp, it shows up here.'
        }
      />

      {/* ---------- Pagination ---------- */}
      {pages > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-gray-400">
            Page {page} of {pages} · {total.toLocaleString('en-PK')} inquiries
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className={ghostBtn}>
                <ChevronLeft className="h-3.5 w-3.5" /> Newer
              </Link>
            ) : (
              <span className={`${ghostBtn} cursor-not-allowed opacity-40`}>
                <ChevronLeft className="h-3.5 w-3.5" /> Newer
              </span>
            )}
            {page < pages ? (
              <Link href={href({ page: page + 1 })} className={ghostBtn}>
                Older <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <span className={`${ghostBtn} cursor-not-allowed opacity-40`}>
                Older <ChevronRight className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
