import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AdminPageHeader, Notice } from '@/components/admin/ui';
import { StarIcon } from '@/components/icons';
import { ExternalLinkIcon } from '@/components/admin/icons';
import { formatRs } from '@/components/ui/Price';
import { displayPrice } from '@/lib/queries';
import { VARIANT_STATUSES, VARIANT_STATUS_COPY } from '@/lib/variant-status';
import { toggleProductHotAction } from '@/app/admin/actions/products';
import { Pager } from '../_catalog/Pager';
import { ProductRowActions } from './_components/ProductRowActions';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;
const STATUS_FILTERS = { published: 'ACTIVE', draft: 'DRAFT', archived: 'ARCHIVED' } as const;
type StatusFilter = keyof typeof STATUS_FILTERS;

const PILL: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: 'Published', cls: 'bg-emerald-100 text-emerald-800' },
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  ARCHIVED: { label: 'Archived', cls: 'bg-gray-200 text-gray-600' },
};

const inputCls =
  'min-h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });

function priceRange(prices: number[]): string {
  const min = displayPrice(prices);
  if (min == null) return 'Price on request';
  const max = Math.max(...prices.filter((p) => p > 0));
  return min === max ? formatRs(min) : `${formatRs(min)} – ${formatRs(max)}`;
}

function availability(statuses: string[]): string {
  if (!statuses.length) return 'No combinations';
  const short: Record<string, string> = { READY_TO_SHIP: 'ready', MADE_TO_ORDER: 'made to order', PRE_ORDER: 'pre-order', SOLD_OUT: 'sold out' };
  return VARIANT_STATUSES.map((s) => [s, statuses.filter((x) => x === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => (statuses.length === 1 ? VARIANT_STATUS_COPY[s].label : `${n} ${short[s]}`))
    .join(' · ');
}

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');
  const q = one('q').trim().slice(0, 100);
  const status = (one('status') in STATUS_FILTERS ? one('status') : '') as StatusFilter | '';
  const missingPhotos = one('photos') === 'missing';
  const soldOut = one('availability') === 'soldout';
  const collectionId = /^\d+$/.test(one('collection')) ? Number(one('collection')) : null;
  const layouts = await prisma.productLayout.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { key: true, name: true } });
  const layoutKey = layouts.some((l) => l.key === one('layout')) ? one('layout') : '';
  const page = Math.max(1, Number.parseInt(one('page') || '1', 10) || 1);
  const deleted = one('deleted') === '1';

  const where: Prisma.ProductWhereInput = {
    ...(status ? { status: STATUS_FILTERS[status] } : {}),
    ...(q ? { title: { contains: q } } : {}),
    ...(missingPhotos ? { images: { none: {} } } : {}),
    ...(soldOut ? { variants: { some: {}, every: { status: 'SOLD_OUT' } } } : {}),
    ...(collectionId ? { collections: { some: { id: collectionId } } } : {}),
    ...(layoutKey ? { layout: layoutKey } : {}),
  };

  const [total, products, collections] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        title: true,
        handle: true,
        status: true,
        hot: true,
        updatedAt: true,
        images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1, select: { src: true } },
        variants: { select: { price: true, status: true } },
      },
    }),
    prisma.collection.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (status) query.status = status;
  if (missingPhotos) query.photos = 'missing';
  if (soldOut) query.availability = 'soldout';
  if (collectionId) query.collection = String(collectionId);
  if (layoutKey) query.layout = layoutKey;
  const filtered = Object.keys(query).length > 0;

  const rows = products.map((p) => ({
    ...p,
    price: priceRange(p.variants.map((v) => v.price)),
    avail: availability(p.variants.map((v) => v.status)),
    pill: PILL[p.status] ?? PILL.DRAFT,
    updated: dateFmt.format(p.updatedAt),
  }));

  const Thumb = ({ src }: { src?: string }) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-white object-contain" />
    ) : (
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-[10px] font-semibold text-gray-400">
        No photo
      </span>
    );

  // the star is the product editor's "Best seller" tick: it decides the home page's Hot Selling Products row
  const starLabel = (hot: boolean) =>
    hot
      ? 'Best seller: in Hot Selling Products on the home page. Click to take it out'
      : 'Mark as best seller: puts it in Hot Selling Products on the home page';
  const Star = ({ id, hot }: { id: number; hot: boolean }) => (
    <form action={toggleProductHotAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        aria-label={starLabel(hot)}
        title={starLabel(hot)}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition hover:bg-gray-100 ${hot ? 'text-amber-500' : 'text-gray-300 hover:text-amber-400'}`}
      >
        <StarIcon className="h-5 w-5" filled={hot} />
      </button>
    </form>
  );

  const ViewLink = ({ handle, status: st }: { handle: string; status: string }) =>
    st === 'ACTIVE' ? (
      <a
        href={`/products/${handle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View on store"
        title="View on store"
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-ink-dark"
      >
        <ExternalLinkIcon className="h-4 w-4" />
      </a>
    ) : (
      <span title="Publish to see it on the store" className="inline-flex h-10 w-10 cursor-not-allowed items-center justify-center text-gray-300">
        <ExternalLinkIcon className="h-4 w-4" />
      </span>
    );

  return (
    <div>
      <AdminPageHeader
        title="Products"
        subtitle={`${total} product${total === 1 ? '' : 's'}${filtered ? ' match' : ' in the catalogue'}`}
        actions={
          <Link
            href="/admin/products/new"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            + New product
          </Link>
        }
      />

      {deleted && (
        <div className="mb-4">
          <Notice tone="success">Product deleted.</Notice>
        </div>
      )}

      <form action="/admin/products" method="get" className="mb-4 grid gap-2 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_auto]">
        <input type="search" name="q" defaultValue={q} placeholder="Search by title…" aria-label="Search products" className={`${inputCls} w-full`} />
        <select name="status" defaultValue={status} aria-label="Status" className={`${inputCls} w-full`}>
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <select name="collection" defaultValue={collectionId ?? ''} aria-label="Collection" className={`${inputCls} w-full`}>
          <option value="">All collections</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select name="layout" defaultValue={layoutKey} aria-label="Page layout" className={`${inputCls} w-full lg:col-span-1`}>
          <option value="">All page layouts</option>
          {layouts.map((l) => (
            <option key={l.key} value={l.key}>
              {l.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 sm:col-span-2 lg:col-span-1">
          <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="photos" value="missing" defaultChecked={missingPhotos} className="h-5 w-5 rounded border-gray-300" />
            Missing photos
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="availability" value="soldout" defaultChecked={soldOut} className="h-5 w-5 rounded border-gray-300" />
            Sold out
          </label>
        </div>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="inline-flex min-h-10 items-center rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand">
            Show products
          </button>
          {filtered && (
            <Link href="/admin/products" className="inline-flex min-h-10 items-center px-2 text-sm font-semibold text-gray-500 hover:text-brand">
              Clear filters
            </Link>
          )}
        </div>
      </form>

      {rows.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          {filtered ? 'No products match these filters.' : 'No products yet.'}
        </div>
      )}

      {rows.length > 0 && (
        <>
          {/* phones: cards */}
          <ul className="space-y-2 sm:hidden">
            {rows.map((p) => (
              <li key={p.id} data-testid="product-row" className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex gap-3">
                  <Thumb src={p.images[0]?.src} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/products/${p.id}`} className="block break-words text-sm font-semibold text-ink-dark hover:text-brand">
                      {p.title}
                    </Link>
                    <p className="text-xs text-gray-600">{p.price}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.pill.cls}`}>{p.pill.label}</span>
                      {p.variants.length} combination{p.variants.length === 1 ? '' : 's'} · {p.avail}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-1">
                  <Link href={`/admin/products/${p.id}`} className="inline-flex min-h-10 items-center px-1 text-sm font-semibold text-brand-600">
                    Edit
                  </Link>
                  <span className="flex items-center">
                    <Star id={p.id} hot={p.hot} />
                    <ViewLink handle={p.handle} status={p.status} />
                    <ProductRowActions id={p.id} title={p.title} />
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {/* wider screens: table */}
          <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm sm:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <th className="px-3 py-3 font-semibold">
                    <span className="sr-only">Photo</span>
                  </th>
                  <th className="px-3 py-3 font-semibold">Product</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Combinations</th>
                  <th className="hidden px-3 py-3 font-semibold lg:table-cell">Updated</th>
                  <th className="px-3 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((p) => (
                  <tr key={p.id} data-testid="product-row" className="hover:bg-gray-50/70">
                    <td className="px-3 py-2">
                      <Thumb src={p.images[0]?.src} />
                    </td>
                    <td className="max-w-xs px-3 py-2">
                      <Link href={`/admin/products/${p.id}`} className="font-medium text-ink-dark hover:text-brand">
                        {p.title}
                      </Link>
                      <span className="block text-xs text-gray-500">{p.price}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${p.pill.cls}`}>{p.pill.label}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {p.variants.length}
                      <span className="block text-xs text-gray-500">{p.avail}</span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-gray-500 lg:table-cell">{p.updated}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end">
                        <Link href={`/admin/products/${p.id}`} className="mr-1 inline-flex min-h-10 items-center px-2 text-sm font-semibold text-brand-600 hover:underline">
                          Edit
                        </Link>
                        <Star id={p.id} hot={p.hot} />
                        <ViewLink handle={p.handle} status={p.status} />
                        <ProductRowActions id={p.id} title={p.title} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Pager page={page} pages={pages} basePath="/admin/products" query={query} />
    </div>
  );
}
