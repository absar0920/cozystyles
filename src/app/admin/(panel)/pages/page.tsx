import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { togglePagePublishedAction, deletePageAction } from '@/app/admin/actions/pages';
import { AdminPageHeader, Notice, ToggleSwitch } from '@/components/admin/ui';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { SearchIcon } from '@/components/admin/icons';
import { EditIcon, PlusIcon } from '@/components/icons';
import { deleteConsequences } from './_lib/consequences';

import { decodeEntities } from '@/components/pages/content';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pages',
  robots: { index: false, follow: false },
};

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const ghostBtn =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50';

function KindChip({ kind }: { kind: string }) {
  const designed = kind === 'DESIGNED';
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        designed ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {designed ? 'Custom design' : 'Text page'}
    </span>
  );
}

/** Text pages and custom-design pages (blog posts have their own list). SPEC §5.3.2. */
export default async function PagesListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const deleted = sp.deleted === '1';

  const where: Prisma.PageWhereInput = {
    kind: { in: ['TEXT', 'DESIGNED'] },
    ...(q ? { title: { contains: q } } : {}),
  };
  const items = await prisma.page.findMany({
    where,
    orderBy: [{ kind: 'desc' }, { updatedAt: 'desc' }], // TEXT before DESIGNED
    select: { id: true, kind: true, title: true, handle: true, published: true, updatedAt: true },
  });
  for (const row of items) row.title = decodeEntities(row.title);
  const consequences = new Map(
    await Promise.all(items.filter((p) => p.kind === 'TEXT').map(async (p) => [p.id, await deleteConsequences(p)] as const)),
  );

  return (
    <div>
      <AdminPageHeader
        title="Pages"
        subtitle="Policy pages and other text pages, plus the pages with a custom design"
        actions={
          <Link
            href="/admin/pages/new"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            <PlusIcon className="h-4 w-4" /> New page
          </Link>
        }
      />

      {deleted && (
        <div className="mb-4">
          <Notice tone="success">Page deleted.</Notice>
        </div>
      )}

      <form action="/admin/pages" method="get" className="mb-4 flex gap-2" role="search">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search pages"
            placeholder="Search pages…"
            className="min-h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <button type="submit" className={ghostBtn}>
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(0,1fr)_8rem_10rem_7rem_11rem] gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500 md:grid">
          <span>Title</span>
          <span>Kind</span>
          <span>Visible on the store</span>
          <span>Updated</span>
          <span className="sr-only">Actions</span>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">{q ? 'No pages match your search.' : 'No pages yet.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((p) => (
              <li
                key={p.id}
                data-testid="page-row"
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_8rem_10rem_7rem_11rem]"
              >
                <div className="min-w-0">
                  <Link href={`/admin/pages/${p.id}`} className="break-words font-heading text-sm font-bold text-brand-700 hover:underline">
                    {p.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-gray-400 md:hidden">
                    <KindChip kind={p.kind} /> <span className="ml-1">Updated {fmtDate(p.updatedAt)}</span>
                  </p>
                </div>
                <div className="hidden md:block">
                  <KindChip kind={p.kind} />
                </div>
                <div className="flex items-center gap-2">
                  <ToggleSwitch
                    label={`Visible on the store: ${p.title}`}
                    checked={p.published}
                    formAction={togglePagePublishedAction}
                    fields={{ id: String(p.id) }}
                  />
                  <span className={`hidden text-xs font-medium sm:inline ${p.published ? 'text-emerald-700' : 'text-gray-400'}`}>
                    {p.published ? 'Published' : 'Hidden'}
                  </span>
                </div>
                <span className="hidden text-sm text-gray-500 md:block">{fmtDate(p.updatedAt)}</span>
                <div className="col-span-2 flex items-center justify-end gap-2 md:col-span-1">
                  <Link href={`/admin/pages/${p.id}`} className={ghostBtn} aria-label={`Edit ${p.title}`}>
                    <EditIcon className="h-3.5 w-3.5" /> Edit
                  </Link>
                  {p.kind === 'TEXT' ? (
                    <ConfirmDelete
                      action={deletePageAction}
                      fields={{ id: String(p.id) }}
                      title={`Delete “${p.title}”?`}
                      consequences={consequences.get(p.id) ?? []}
                      trigger="icon"
                      triggerLabel={`Delete ${p.title}`}
                    />
                  ) : (
                    <ConfirmDelete
                      action={deletePageAction}
                      fields={{ id: String(p.id) }}
                      title={`Delete “${p.title}”?`}
                      consequences={[]}
                      trigger="icon"
                      triggerLabel={`Delete ${p.title}`}
                      disabled
                      disabledReason="Custom-design pages can be hidden but not deleted"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
