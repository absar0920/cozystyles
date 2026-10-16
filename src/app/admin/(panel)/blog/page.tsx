import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { toggleBlogPostPublishedAction, deleteBlogPostAction } from '@/app/admin/actions/pages';
import { AdminPageHeader, Notice, ToggleSwitch } from '@/components/admin/ui';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { ImageIcon, SearchIcon } from '@/components/admin/icons';
import { EditIcon, PlusIcon } from '@/components/icons';
import { splitTags } from '@/components/pages/blog-data';
import { deleteConsequences } from '../pages/_lib/consequences';

import { decodeEntities } from '@/components/pages/content';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog posts',
  robots: { index: false, follow: false },
};

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

const ghostBtn =
  'inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50';

/** Blog posts, newest first. SPEC §5.3.3. */
export default async function BlogListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const deleted = sp.deleted === '1';

  const where: Prisma.PageWhereInput = { kind: 'BLOG', ...(q ? { title: { contains: q } } : {}) };
  const posts = await prisma.page.findMany({
    where,
    orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    select: {
      id: true,
      kind: true,
      handle: true,
      title: true,
      published: true,
      publishedAt: true,
      createdAt: true,
      author: true,
      featuredImage: true,
      tags: true,
    },
  });
  for (const row of posts) row.title = decodeEntities(row.title);
  const consequences = new Map(await Promise.all(posts.map(async (p) => [p.id, await deleteConsequences(p)] as const)));

  return (
    <div>
      <AdminPageHeader
        title="Blog posts"
        subtitle="News, ideas and guides shown on the store’s blog"
        actions={
          <Link
            href="/admin/blog/new"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-900 px-4 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            <PlusIcon className="h-4 w-4" /> New post
          </Link>
        }
      />

      {deleted && (
        <div className="mb-4">
          <Notice tone="success">Blog post deleted.</Notice>
        </div>
      )}

      <form action="/admin/blog" method="get" className="mb-4 flex gap-2" role="search">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            aria-label="Search blog posts"
            placeholder="Search blog posts…"
            className="min-h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <button type="submit" className={ghostBtn}>
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {posts.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">{q ? 'No posts match your search.' : 'No blog posts yet.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {posts.map((p) => {
              const tags = splitTags(p.tags);
              return (
                <li key={p.id} data-testid="blog-row" className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Link
                      href={`/admin/blog/${p.id}`}
                      tabIndex={-1}
                      aria-hidden
                      className="flex h-14 w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100 text-gray-300"
                    >
                      {p.featuredImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.featuredImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <ImageIcon className="h-6 w-6" />
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link href={`/admin/blog/${p.id}`} className="break-words font-heading text-sm font-bold text-brand-700 hover:underline">
                        {p.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {fmtDate(p.publishedAt ?? p.createdAt)}
                        {p.author && <> · {p.author}</>}
                      </p>
                      {tags.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1">
                          {tags.map((t) => (
                            <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                              {t}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="flex items-center gap-2">
                      <ToggleSwitch
                        label={`Visible on the store: ${p.title}`}
                        checked={p.published}
                        formAction={toggleBlogPostPublishedAction}
                        fields={{ id: String(p.id) }}
                      />
                      <span className={`w-16 text-xs font-medium ${p.published ? 'text-emerald-700' : 'text-gray-400'}`}>
                        {p.published ? 'Published' : 'Hidden'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/blog/${p.id}`} className={ghostBtn} aria-label={`Edit ${p.title}`}>
                        <EditIcon className="h-3.5 w-3.5" /> Edit
                      </Link>
                      <ConfirmDelete
                        action={deleteBlogPostAction}
                        fields={{ id: String(p.id) }}
                        title={`Delete “${p.title}”?`}
                        consequences={consequences.get(p.id) ?? []}
                        trigger="icon"
                        triggerLabel={`Delete ${p.title}`}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
