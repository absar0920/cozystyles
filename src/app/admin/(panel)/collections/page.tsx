import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminPageHeader, AdminTable, Badge, EmptyRow } from '@/components/admin/ui';
import { TrashIcon } from '@/components/icons';
import { deleteCollectionAction } from '@/app/admin/actions/catalog';
import { ConfirmSubmit } from '../_catalog/ConfirmSubmit';
import { Pager } from '../_catalog/Pager';

export const metadata: Metadata = {
  title: 'Collections',
  robots: { index: false, follow: false },
};


export const dynamic = 'force-dynamic';

const PER_PAGE = 20;

const inputCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

export default async function AdminCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);
  const error = typeof sp.error === 'string' ? sp.error : undefined;
  const deleted = sp.deleted === '1';

  const where = q ? { OR: [{ title: { contains: q } }, { handle: { contains: q } }] } : {};

  const [total, collections] = await Promise.all([
    prisma.collection.count({ where }),
    prisma.collection.findMany({
      where,
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        parent: { select: { title: true } },
        _count: { select: { products: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const query: Record<string, string> = {};
  if (q) query.q = q;

  return (
    <div>
      <AdminPageHeader
        title="Collections"
        subtitle={`${total} collection${total === 1 ? '' : 's'} — categories, rooms, lookbooks and helpers`}
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

      <form action="/admin/collections" method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input type="search" name="q" defaultValue={q} placeholder="Search title or handle…" className={`${inputCls} w-64`} />
        <button type="submit" className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand">
          Search
        </button>
        {q && (
          <Link href="/admin/collections" className="px-2 text-sm font-medium text-gray-400 hover:text-brand">
            Clear
          </Link>
        )}
      </form>

      <AdminTable head={['Collection', 'Parent', 'Kind', 'Products', 'In Nav', 'Featured', 'Pos', 'Actions']}>
        {collections.length === 0 && <EmptyRow colSpan={8} message={q ? `No collections match “${q}”.` : 'No collections yet.'} />}
        {collections.map((c) => (
          <tr key={c.id} className="hover:bg-gray-50/70">
            <td className="px-4 py-2.5">
              <Link href={`/admin/collections/${c.id}`} className="font-medium text-ink-dark hover:text-brand">
                {c.title}
              </Link>
              <a
                href={`/collections/${c.handle}`}
                target="_blank"
                rel="noreferrer"
                className="block font-mono text-[11px] text-gray-400 hover:text-brand"
                title="View on store (opens new tab)"
              >
                {c.handle}
              </a>
            </td>
            <td className="px-4 py-2.5 text-gray-600">{c.parent?.title ?? '—'}</td>
            <td className="px-4 py-2.5">
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">{c.kind}</span>
            </td>
            <td className="px-4 py-2.5 text-gray-700">{c._count.products}</td>
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
