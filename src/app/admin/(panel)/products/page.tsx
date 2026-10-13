import Link from 'next/link';
import { prisma } from '@/lib/db';
import { formatPKR } from '@/lib/money';
import { AdminPageHeader, AdminTable, Badge, EmptyRow } from '@/components/admin/ui';
import { StarIcon, TrashIcon } from '@/components/icons';
import { deleteProductAction, toggleProductHotAction } from '@/app/admin/actions/catalog';
import { ConfirmSubmit } from '../_catalog/ConfirmSubmit';
import { Pager } from '../_catalog/Pager';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;
const STATUSES = ['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const;

const inputCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const status = typeof sp.status === 'string' && (STATUSES as readonly string[]).includes(sp.status) ? sp.status : 'ALL';
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);
  const error = typeof sp.error === 'string' ? sp.error : undefined;
  const deleted = sp.deleted === '1';

  const where = {
    ...(status !== 'ALL' ? { status } : {}),
    ...(q ? { OR: [{ title: { contains: q } }, { handle: { contains: q } }] } : {}),
  };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ id: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        images: { orderBy: { position: 'asc' }, take: 1, select: { src: true } },
        variants: { select: { price: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (status !== 'ALL') query.status = status;

  const pill = (value: string, label: string) => {
    const active = status === value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (value !== 'ALL') params.set('status', value);
    const qs = params.toString();
    return (
      <Link
        key={value}
        href={qs ? `/admin/products?${qs}` : '/admin/products'}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          active ? 'bg-brand text-white' : 'bg-white text-gray-600 hover:text-brand'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div>
      <AdminPageHeader
        title="Products"
        subtitle={`${total} product${total === 1 ? '' : 's'} in the catalog`}
        actions={
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            + New product
          </Link>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </div>
      )}
      {deleted && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" role="status">
          Product deleted.
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form action="/admin/products" method="get" className="flex flex-wrap items-center gap-2">
          <input type="search" name="q" defaultValue={q} placeholder="Search title or handle…" className={`${inputCls} w-56`} />
          <select name="status" defaultValue={status} className={`${inputCls} w-40`} aria-label="Status filter">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'ALL' ? 'All statuses' : s}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand">
            Search
          </button>
          {(q || status !== 'ALL') && (
            <Link href="/admin/products" className="px-2 text-sm font-medium text-gray-400 hover:text-brand">
              Clear
            </Link>
          )}
        </form>
        <div className="flex items-center gap-1.5">
          {pill('ALL', 'All')}
          {pill('ACTIVE', 'Active')}
          {pill('DRAFT', 'Draft')}
          {pill('ARCHIVED', 'Archived')}
        </div>
      </div>

      <AdminTable head={['', 'Product', 'Type', 'Variants', 'Price', 'Status', 'Hot', 'Actions']}>
        {products.length === 0 && <EmptyRow colSpan={8} message={q ? `No products match “${q}”.` : 'No products yet.'} />}
        {products.map((p) => {
          const prices = p.variants.map((v) => v.price);
          const min = prices.length ? Math.min(...prices) : null;
          const max = prices.length ? Math.max(...prices) : null;
          return (
            <tr key={p.id} className="hover:bg-gray-50/70">
              <td className="px-4 py-2.5">
                {p.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.images[0].src} alt="" width={44} height={44} className="h-11 w-11 rounded-lg border border-gray-200 object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-[9px] font-semibold text-gray-300">
                    IMG
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <a
                  href={`/products/${p.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-ink-dark hover:text-brand"
                  title="View on store (opens new tab)"
                >
                  {p.title}
                </a>
                <span className="block font-mono text-[11px] text-gray-400">{p.handle}</span>
              </td>
              <td className="px-4 py-2.5 text-gray-600">{p.productType || '—'}</td>
              <td className="px-4 py-2.5 text-gray-600">{p.variants.length}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                {min == null ? '—' : min === max ? formatPKR(min) : `${formatPKR(min)} – ${formatPKR(max ?? min)}`}
              </td>
              <td className="px-4 py-2.5">
                <Badge>{p.status}</Badge>
              </td>
              <td className="px-4 py-2.5">
                <form action={toggleProductHotAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    title={p.hot ? 'Hot — click to remove' : 'Click to mark as hot'}
                    className={`transition ${p.hot ? 'text-amber-500 hover:text-amber-400' : 'text-gray-300 hover:text-amber-400'}`}
                  >
                    <StarIcon className="h-5 w-5" filled={p.hot} />
                  </button>
                </form>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <Link href={`/admin/products/${p.id}`} className="text-sm font-semibold text-brand hover:text-brand-600">
                    Edit
                  </Link>
                  <form action={deleteProductAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <ConfirmSubmit
                      message={`Delete “${p.title}”? This also removes its variants, images and reviews.`}
                      title="Delete product"
                      className="text-gray-400 transition hover:text-red-600"
                    >
                      <span className="sr-only">Delete</span>
                      <TrashIcon className="h-4 w-4" />
                    </ConfirmSubmit>
                  </form>
                </div>
              </td>
            </tr>
          );
        })}
      </AdminTable>

      <Pager page={page} pages={pages} basePath="/admin/products" query={query} />
    </div>
  );
}
