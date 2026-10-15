import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AdminPageHeader, AdminTable, Badge, EmptyRow } from '@/components/admin/ui';
import { TrashIcon } from '@/components/icons';
import { deleteCollectionAction } from '@/app/admin/actions/catalog';
import { ConfirmSubmit } from '../_catalog/ConfirmSubmit';
import { Pager } from '../_catalog/Pager';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;
const KINDS = ['ALL', 'CATEGORY', 'ROOM', 'LOOKBOOK', 'HELPER'] as const;
/** Level: any, top-level only, sub-collections only — or a specific parent's numeric id. */
const LEVELS = ['', 'top', 'sub'] as const;
const PRODUCTS = ['', 'with', 'empty'] as const;
const NAV = ['', 'shown', 'hidden'] as const;
const FEATURED = ['', 'yes', 'no'] as const;
const SORTS = {
  position: { label: 'Position', orderBy: [{ position: 'asc' }, { id: 'asc' }] },
  title: { label: 'Title A–Z', orderBy: [{ title: 'asc' }, { id: 'asc' }] },
  products: { label: 'Most products', orderBy: [{ products: { _count: 'desc' } }, { id: 'asc' }] },
  newest: { label: 'Newest first', orderBy: [{ id: 'desc' }] },
} satisfies Record<string, { label: string; orderBy: Prisma.CollectionOrderByWithRelationInput[] }>;
type SortKey = keyof typeof SORTS;

const inputCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

/** First value of a search param if it is one of `allowed`, else the default (allowed[0]). */
function pick<T extends string>(raw: string | string[] | undefined, allowed: readonly T[]): T {
  return typeof raw === 'string' && (allowed as readonly string[]).includes(raw) ? (raw as T) : allowed[0];
}

export default async function AdminCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const kind = pick(sp.kind, KINDS);
  const parentId = typeof sp.level === 'string' && /^\d+$/.test(sp.level) ? Number(sp.level) : null;
  const level = parentId != null ? String(parentId) : pick(sp.level, LEVELS);
  const products = pick(sp.products, PRODUCTS);
  const nav = pick(sp.nav, NAV);
  const featured = pick(sp.featured, FEATURED);
  const sort: SortKey = typeof sp.sort === 'string' && sp.sort in SORTS ? (sp.sort as SortKey) : 'position';
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);
  const error = typeof sp.error === 'string' ? sp.error : undefined;
  const deleted = sp.deleted === '1';

  // Every filter except kind — the kind tabs show counts within the other active filters.
  const base: Prisma.CollectionWhereInput = {
    ...(q ? { OR: [{ title: { contains: q } }, { handle: { contains: q } }] } : {}),
    ...(parentId != null ? { parentId } : level === 'top' ? { parentId: null } : level === 'sub' ? { parentId: { not: null } } : {}),
    ...(products === 'with' ? { products: { some: {} } } : products === 'empty' ? { products: { none: {} } } : {}),
    ...(nav ? { showInNav: nav === 'shown' } : {}),
    ...(featured ? { featured: featured === 'yes' } : {}),
  };
  const where: Prisma.CollectionWhereInput = kind !== 'ALL' ? { ...base, kind } : base;

  const [total, collections, kindCounts, parents, grandTotal] = await Promise.all([
    prisma.collection.count({ where }),
    prisma.collection.findMany({
      where,
      orderBy: SORTS[sort].orderBy,
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        parent: { select: { id: true, title: true } },
        _count: { select: { products: true, children: true } },
      },
    }),
    prisma.collection.groupBy({ by: ['kind'], where: base, _count: { _all: true } }),
    // Only collections that actually have sub-collections are useful as a parent filter.
    prisma.collection.findMany({
      where: { children: { some: {} } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, _count: { select: { children: true } } },
    }),
    prisma.collection.count(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const countByKind = new Map(kindCounts.map((k) => [k.kind, k._count._all]));
  const baseTotal = kindCounts.reduce((sum, k) => sum + k._count._all, 0);

  // Current filters as query params (defaults omitted) — shared by the pager, kind tabs and chips.
  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (kind !== 'ALL') query.kind = kind;
  if (level) query.level = level;
  if (products) query.products = products;
  if (nav) query.nav = nav;
  if (featured) query.featured = featured;
  if (sort !== 'position') query.sort = sort;

  const hrefWith = (overrides: Record<string, string | null>) => {
    const params = new URLSearchParams(query);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const qs = params.toString();
    return qs ? `/admin/collections?${qs}` : '/admin/collections';
  };

  const parentTitle = parentId != null ? parents.find((p) => p.id === parentId)?.title ?? `#${parentId}` : null;
  const chips: { label: string; key: string }[] = [
    ...(q ? [{ label: `“${q}”`, key: 'q' }] : []),
    ...(level === 'top' ? [{ label: 'Top-level', key: 'level' }] : []),
    ...(level === 'sub' ? [{ label: 'Sub-collections', key: 'level' }] : []),
    ...(parentTitle ? [{ label: `Inside ${parentTitle}`, key: 'level' }] : []),
    ...(products ? [{ label: products === 'with' ? 'Has products' : 'Empty', key: 'products' }] : []),
    ...(nav ? [{ label: nav === 'shown' ? 'Shown in nav' : 'Hidden from nav', key: 'nav' }] : []),
    ...(featured ? [{ label: featured === 'yes' ? 'Featured' : 'Not featured', key: 'featured' }] : []),
  ];
  const filtered = Object.keys(query).some((k) => k !== 'sort');

  const kindTab = (value: (typeof KINDS)[number]) => {
    const active = kind === value;
    const count = value === 'ALL' ? baseTotal : countByKind.get(value) ?? 0;
    return (
      <Link
        key={value}
        href={hrefWith({ kind: value === 'ALL' ? null : value })}
        aria-current={active ? 'page' : undefined}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
          active ? 'bg-brand text-white' : 'bg-white text-gray-600 hover:text-brand'
        }`}
      >
        {value === 'ALL' ? 'All' : value.charAt(0) + value.slice(1).toLowerCase()}
        <span className={`tabular-nums ${active ? 'text-white/70' : 'text-gray-400'}`}>{count}</span>
      </Link>
    );
  };

  return (
    <div>
      <AdminPageHeader
        title="Collections"
        subtitle={
          filtered
            ? `${total} of ${grandTotal} collections match your filters`
            : `${total} collection${total === 1 ? '' : 's'} — categories, rooms, lookbooks and helpers`
        }
        actions={
          <Link
            href="/admin/collections/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            + New collection
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
          Collection deleted.
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">{KINDS.map(kindTab)}</div>

      <form action="/admin/collections" method="get" className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        {kind !== 'ALL' && <input type="hidden" name="kind" value={kind} />}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search title or handle…"
            aria-label="Search collections"
            className={`${inputCls} min-w-0 sm:col-span-2 lg:col-span-1 xl:col-span-2`}
          />
          <select name="level" defaultValue={level} aria-label="Level or parent" className={`${inputCls} min-w-0`}>
            <option value="">Any level</option>
            <option value="top">Top-level</option>
            <option value="sub">Sub-collections</option>
            {parents.length > 0 && (
              <optgroup label="Inside parent…">
                {parents.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title} ({p._count.children})
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <select name="products" defaultValue={products} aria-label="Products filter" className={`${inputCls} min-w-0`}>
            <option value="">Any product count</option>
            <option value="with">Has products</option>
            <option value="empty">Empty</option>
          </select>
          <select name="nav" defaultValue={nav} aria-label="Navigation visibility" className={`${inputCls} min-w-0`}>
            <option value="">Nav: any</option>
            <option value="shown">Shown in nav</option>
            <option value="hidden">Hidden from nav</option>
          </select>
          <select name="featured" defaultValue={featured} aria-label="Featured filter" className={`${inputCls} min-w-0`}>
            <option value="">Featured: any</option>
            <option value="yes">Featured</option>
            <option value="no">Not featured</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-500">
            Sort
            <select name="sort" defaultValue={sort} className={`${inputCls} py-1.5`}>
              {(Object.keys(SORTS) as SortKey[]).map((s) => (
                <option key={s} value={s}>
                  {SORTS[s].label}
                </option>
              ))}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            {(filtered || sort !== 'position') && (
              <Link href="/admin/collections" className="px-2 text-sm font-medium text-gray-400 hover:text-brand">
                Reset all
              </Link>
            )}
            <button type="submit" className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand">
              Apply filters
            </button>
          </div>
        </div>
      </form>

      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <Link
              key={c.key}
              href={hrefWith({ [c.key]: null })}
              title="Remove filter"
              className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-0.5 text-xs font-medium text-brand hover:border-brand/40"
            >
              {c.label}
              <span aria-hidden className="text-brand/50">×</span>
              <span className="sr-only">(remove)</span>
            </Link>
          ))}
        </div>
      )}

      <AdminTable head={['Collection', 'Parent', 'Kind', 'Products', 'In Nav', 'Featured', 'Pos', 'Actions']}>
        {collections.length === 0 && (
          <EmptyRow colSpan={8} message={filtered ? 'No collections match these filters.' : 'No collections yet.'} />
        )}
        {collections.map((c) => (
          <tr key={c.id} className="hover:bg-gray-50/70">
            <td className="max-w-[16rem] px-4 py-2.5">
              <Link href={`/admin/collections/${c.id}`} className="block truncate font-medium text-ink-dark hover:text-brand" title={c.title}>
                {c.title}
              </Link>
              <a
                href={`/collections/${c.handle}`}
                target="_blank"
                rel="noreferrer"
                className="block truncate font-mono text-[11px] text-gray-400 hover:text-brand"
                title="View on store (opens new tab)"
              >
                {c.handle}
              </a>
              {c._count.children > 0 && (
                <Link href={hrefWith({ level: String(c.id), page: null })} className="text-[11px] font-medium text-brand/70 hover:text-brand">
                  {c._count.children} sub-collection{c._count.children === 1 ? '' : 's'} →
                </Link>
              )}
            </td>
            <td className="max-w-[12rem] px-4 py-2.5 text-gray-600">
              {c.parent ? (
                <Link href={hrefWith({ level: String(c.parent.id), page: null })} className="block truncate hover:text-brand" title={`Show everything inside ${c.parent.title}`}>
                  {c.parent.title}
                </Link>
              ) : (
                '—'
              )}
            </td>
            <td className="px-4 py-2.5">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">{c.kind}</span>
            </td>
            <td className={`px-4 py-2.5 tabular-nums ${c._count.products === 0 ? 'text-gray-300' : 'text-gray-700'}`}>{c._count.products}</td>
            <td className="px-4 py-2.5">
              {c.showInNav ? <Badge>ACTIVE</Badge> : <span className="text-xs text-gray-400">hidden</span>}
            </td>
            <td className="px-4 py-2.5">
              {c.featured ? <span className="text-sm font-semibold text-amber-500">★</span> : <span className="text-xs text-gray-300">—</span>}
            </td>
            <td className="px-4 py-2.5 text-gray-500">{c.position}</td>
            <td className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <Link href={`/admin/collections/${c.id}`} className="text-sm font-semibold text-brand hover:text-brand-600">
                  Edit
                </Link>
                <form action={deleteCollectionAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmSubmit
                    message={`Delete “${c.title}”? Its sub-collections will move to the top level.`}
                    title="Delete collection"
                    className="text-gray-400 transition hover:text-red-600"
                  >
                    <span className="sr-only">Delete</span>
                    <TrashIcon className="h-4 w-4" />
                  </ConfirmSubmit>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </AdminTable>

      <Pager page={page} pages={pages} basePath="/admin/collections" query={query} />
    </div>
  );
}
