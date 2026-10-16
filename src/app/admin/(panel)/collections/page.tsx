import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AdminPageHeader, Notice } from '@/components/admin/ui';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { ImageIcon } from '@/components/admin/icons';
import { deleteCollectionAction } from '@/app/admin/actions/collections';
import { Pager } from '../_catalog/Pager';
import { collectionDeleteConsequences } from './_lib/consequences';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;
/** Level: any, top-level only, sub-collections only — or a specific parent's numeric id. */
const LEVELS = ['', 'top', 'sub'] as const;
const PRODUCTS = ['', 'with', 'empty'] as const;
const SORTS = {
  title: { label: 'Name (A–Z)', orderBy: [{ title: 'asc' }, { id: 'asc' }] },
  recent: { label: 'Recently added', orderBy: [{ id: 'desc' }] },
} satisfies Record<string, { label: string; orderBy: Prisma.CollectionOrderByWithRelationInput[] }>;
type SortKey = keyof typeof SORTS;

const inputCls =
  'min-h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

function pick<T extends string>(raw: string | string[] | undefined, allowed: readonly T[]): T {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : allowed[0];
}

export default async function AdminCollectionsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const parentId = typeof sp.level === 'string' && /^\d+$/.test(sp.level) ? Number(sp.level) : null;
  const level = parentId != null ? String(parentId) : pick(sp.level, LEVELS);
  const products = pick(sp.products, PRODUCTS);
  const sort: SortKey = sp.sort === 'recent' ? 'recent' : 'title';
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);
  const deleted = sp.deleted === '1';

  const where: Prisma.CollectionWhereInput = {
    ...(q ? { title: { contains: q } } : {}),
    ...(parentId != null ? { parentId } : level === 'top' ? { parentId: null } : level === 'sub' ? { parentId: { not: null } } : {}),
    ...(products === 'with' ? { products: { some: {} } } : products === 'empty' ? { products: { none: {} } } : {}),
  };

  const [total, collections, parents, grandTotal] = await Promise.all([
    prisma.collection.count({ where }),
    prisma.collection.findMany({
      where,
      orderBy: SORTS[sort].orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        parent: { select: { id: true, title: true } },
        indexCard: { select: { id: true } },
        _count: { select: { products: true, children: true } },
      },
    }),
    prisma.collection.findMany({
      where: { children: { some: {} } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, _count: { select: { children: true } } },
    }),
    prisma.collection.count(),
  ]);
  const consequences = await Promise.all(collections.map((c) => collectionDeleteConsequences(c)));
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (level) query.level = level;
  if (products) query.products = products;
  if (sort !== 'title') query.sort = sort;
  const filtered = !!(q || level || products);

  const hrefWith = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(query);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    return qs ? `/admin/collections?${qs}` : '/admin/collections';
  };

  return (
    <div>
      <AdminPageHeader
        title="Collections"
        subtitle={filtered ? `${total} of ${grandTotal} collections match` : `${total} collection${total === 1 ? '' : 's'}`}
        actions={
          <>
            <Link
              href="/admin/collections/arrange"
              className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Arrange Collections page
            </Link>
            <Link
              href="/admin/collections/new"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              + New collection
            </Link>
          </>
        }
      />

      {deleted && (
        <div className="mb-4">
          <Notice tone="success">Collection deleted.</Notice>
        </div>
      )}

      <form action="/admin/collections" method="get" className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1.2fr_1.2fr_1fr_auto]">
          <input type="search" name="q" defaultValue={q} placeholder="Search collections…" aria-label="Search collections" className={`${inputCls} min-w-0`} />
          <select name="level" defaultValue={level} aria-label="Level" className={`${inputCls} min-w-0`}>
            <option value="">Any level</option>
            <option value="top">Top level only</option>
            <option value="sub">Inside another collection</option>
            {parents.length > 0 && (
              <optgroup label="Inside…">
                {parents.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title} ({p._count.children})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <select name="products" defaultValue={products} aria-label="Products" className={`${inputCls} min-w-0`}>
            <option value="">Any number of products</option>
            <option value="with">Has products</option>
            <option value="empty">No products</option>
          </select>
          <select name="sort" defaultValue={sort} aria-label="Sort" className={`${inputCls} min-w-0`}>
            {(Object.keys(SORTS) as SortKey[]).map((s) => (
              <option key={s} value={s}>
                Sort: {SORTS[s].label}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <button type="submit" className="min-h-10 flex-1 rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand">
              Apply
            </button>
            {(filtered || sort !== 'title') && (
              <Link href="/admin/collections" className="px-2 text-sm font-medium text-gray-500 hover:text-brand">
                Reset
              </Link>
            )}
          </div>
        </div>
      </form>

      {collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
          {filtered ? 'No collections match these filters.' : 'No collections yet.'}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[minmax(0,3fr)_minmax(0,2fr)_6rem_9rem_13rem] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:grid">
            <span>Collection</span>
            <span>Inside</span>
            <span>Products</span>
            <span>Collections page</span>
            <span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {collections.map((c, i) => (
              <li
                key={c.id}
                data-testid="collection-row"
                className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_6rem_9rem_13rem] sm:items-center sm:gap-4"
              >
                <div className="row-span-3 flex min-w-0 items-center gap-3 sm:row-span-1">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 sm:h-11 sm:w-11">
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-gray-300" />
                    )}
                  </div>
                  <div className="hidden min-w-0 sm:block">
                    <Link href={`/admin/collections/${c.id}`} className="block truncate font-medium text-ink-dark hover:text-brand" title={c.title}>
                      {c.title}
                    </Link>
                    {c._count.children > 0 && (
                      <Link href={hrefWith({ level: String(c.id), page: null })} className="text-xs font-medium text-brand/80 hover:text-brand">
                        {c._count.children} inside →
                      </Link>
                    )}
                  </div>
                </div>
                <Link href={`/admin/collections/${c.id}`} className="truncate font-medium text-ink-dark hover:text-brand sm:hidden">
                  {c.title}
                </Link>
                <div className="min-w-0 truncate text-sm text-gray-600">
                  <span className="text-gray-400 sm:hidden">Inside: </span>
                  {c.parent ? (
                    <Link href={hrefWith({ level: String(c.parent.id), page: null })} className="hover:text-brand">
                      {c.parent.title}
                    </Link>
                  ) : (
                    <span className="text-gray-400">Top level</span>
                  )}
                </div>
                <div className="text-sm text-gray-600 sm:contents">
                  <span className={`tabular-nums ${c._count.products === 0 ? 'text-gray-400' : ''}`}>
                    {c._count.products}
                    <span className="sm:hidden"> product{c._count.products === 1 ? '' : 's'}</span>
                  </span>
                  <span className="sm:hidden"> · </span>
                  <span className={c.indexCard ? 'text-emerald-700' : 'text-gray-400'}>
                    {c.indexCard ? 'Shown' : <span>Not shown</span>}
                    <span className="sm:hidden"> on Collections page</span>
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-1 sm:col-span-1 sm:justify-end">
                  <Link href={`/admin/collections/${c.id}`} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold text-brand hover:bg-brand-50">
                    Edit
                  </Link>
                  <ViewOnStoreLink href={`/collections/${c.handle}`} label="View" />
                  <ConfirmDelete
                    action={deleteCollectionAction}
                    fields={{ id: String(c.id) }}
                    title={`Delete “${c.title}”?`}
                    consequences={consequences[i]}
                    trigger="icon"
                    triggerLabel={`Delete “${c.title}”`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pager page={page} pages={pages} basePath="/admin/collections" query={query} />
    </div>
  );
}
