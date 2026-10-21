import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { togglePagePublishedAction, deletePageAction } from '@/app/admin/actions/content';
import { blogSlug } from '@/components/pages/content';
import { AdminPageHeader, AdminTable, EmptyRow } from '@/components/admin/ui';
import { ChevronLeft, ChevronRight, EditIcon, PlusIcon, SearchIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pages',
  robots: { index: false, follow: false },
};

const PER_PAGE = 20;

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50';

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

/** Public storefront URL for a page — blog posts live under /blogs/news/<slug-after-news->. */
function publicUrl(handle: string, isBlogPost: boolean): string {
  return isBlogPost ? `/blogs/news/${blogSlug(handle)}` : `/pages/${handle}`;
}

function PublishedPill({ published }: { published: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        published ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

export default async function PagesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);
  const deleted = sp.deleted === '1';

  const where: Prisma.PageWhereInput = q
    ? { OR: [{ title: { contains: q } }, { handle: { contains: q } }] }
    : {};

  const [total, items] = await Promise.all([
    prisma.page.count({ where }),
    prisma.page.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (over: Record<string, string | number | null> = {}) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | null> = { q, page, ...over };
    for (const [k, v] of Object.entries(merged)) {
      if (v === null || v === undefined || v === '') continue;
      if (k === 'page' && Number(v) === 1) continue;
      p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `/admin/pages?${s}` : '/admin/pages';
  };

  return (
    <div>
      <AdminPageHeader
        title="Pages"
        subtitle="Static pages and blog posts rendered on the storefront"
        actions={
          <>
            <form action="/admin/pages" method="get" className="flex items-center gap-2">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Search title or handle…"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-64"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                Search
              </button>
            </form>
            <Link
              href="/admin/pages/new"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              <PlusIcon className="h-4 w-4" /> New page
            </Link>
          </>
        }
      />

      {deleted && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Page deleted.
        </div>
      )}

      <AdminTable head={['Title', 'Handle', 'Type', 'Status', 'Updated', '']}>
        {items.length === 0 ? (
          <EmptyRow colSpan={6} message={q ? 'No pages match your search.' : 'No pages yet.'} />
        ) : (
          items.map((p) => (
            <tr key={p.id} className="transition hover:bg-gray-50/70">
              <td className="px-4 py-3">
                <Link href={`/admin/pages/${p.id}`} className="font-heading text-sm font-bold text-brand-700 hover:underline">
                  {p.title}
                </Link>
              </td>
              <td className="px-4 py-3">
                <a
                  href={publicUrl(p.handle, p.isBlogPost)}
                  target="_blank"
                  rel="noopener"
                  className="block max-w-[220px] truncate font-mono text-xs text-gray-500 hover:text-brand hover:underline"
                  title={publicUrl(p.handle, p.isBlogPost)}
                >
                  {publicUrl(p.handle, p.isBlogPost)}
                </a>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    p.isBlogPost ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {p.isBlogPost ? 'Blog post' : 'Page'}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <PublishedPill published={p.published} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-gray-500">{fmtDate(p.updatedAt)}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/admin/pages/${p.id}`} className={ghostBtn} aria-label={`Edit ${p.title}`}>
                    <EditIcon className="h-3.5 w-3.5" /> Edit
                  </Link>
                  <form action={togglePagePublishedAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className={ghostBtn}>
                      {p.published ? 'Unpublish' : 'Publish'}
                    </button>
                  </form>
                  <details className="relative inline-block text-left">
                    <summary className="inline-flex cursor-pointer select-none items-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 [&::-webkit-details-marker]:hidden">
                      Delete
                    </summary>
                    <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                      <p className="text-xs text-gray-500">
                        Permanently delete “{p.title}” and its content? This cannot be undone.
                      </p>
                      <form action={deletePageAction} className="mt-2">
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                        >
                          Yes, delete permanently
                        </button>
                      </form>
                    </div>
                  </details>
                </div>
              </td>
            </tr>
          ))
        )}
      </AdminTable>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {page} of {pages} · {total.toLocaleString('en-PK')} page{total === 1 ? '' : 's'}
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
