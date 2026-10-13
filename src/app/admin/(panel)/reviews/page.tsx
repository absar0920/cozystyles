import Link from 'next/link';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { AdminPageHeader, AdminTable, EmptyRow } from '@/components/admin/ui';
import { StarIcon, TrashIcon } from '@/components/icons';
import { deleteReviewAction, toggleReviewApprovedAction } from '@/app/admin/actions/catalog';
import { ConfirmSubmit } from '../_catalog/ConfirmSubmit';
import { Pager } from '../_catalog/Pager';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;

const inputCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" title={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          className={`h-3.5 w-3.5 ${i <= rating ? 'text-amber-500' : 'text-gray-300'}`}
          filled={i <= rating}
        />
      ))}
    </span>
  );
}

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const approvedParam = typeof sp.approved === 'string' ? sp.approved : 'all';
  const approvedFilter = approvedParam === 'true' ? true : approvedParam === 'false' ? false : null;
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);

  const where: Prisma.ReviewWhereInput = {
    ...(approvedFilter != null ? { approved: approvedFilter } : {}),
    ...(q
      ? {
          OR: [
            { author: { contains: q } },
            { body: { contains: q } },
            { product: { title: { contains: q } } },
            { product: { handle: { contains: q } } },
          ],
        }
      : {}),
  };

  const [total, reviews] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { product: { select: { title: true, handle: true } } },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const query: Record<string, string> = {};
  if (q) query.q = q;
  if (approvedFilter != null) query.approved = approvedParam;

  const pill = (value: string, label: string) => {
    const active = approvedParam === value;
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (value !== 'all') params.set('approved', value);
    const qs = params.toString();
    return (
      <Link
        href={qs ? `/admin/reviews?${qs}` : '/admin/reviews'}
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
      <AdminPageHeader title="Reviews" subtitle={`${total} customer review${total === 1 ? '' : 's'} across the catalog`} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form action="/admin/reviews" method="get" className="flex flex-wrap items-center gap-2">
          <input type="search" name="q" defaultValue={q} placeholder="Search author, text or product…" className={`${inputCls} w-64`} />
          <button type="submit" className="rounded-lg bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand">
            Search
          </button>
          {q && (
            <Link href="/admin/reviews" className="px-2 text-sm font-medium text-gray-400 hover:text-brand">
              Clear
            </Link>
          )}
        </form>
        <div className="flex items-center gap-1.5">
          {pill('all', 'All')}
          {pill('true', 'Approved')}
          {pill('false', 'Pending')}
        </div>
      </div>

      <AdminTable head={['Product', 'Author', 'Rating', 'Review', 'Status', 'Date', 'Actions']}>
        {reviews.length === 0 && <EmptyRow colSpan={7} message={q ? 'No reviews match your search.' : 'No reviews yet.'} />}
        {reviews.map((r) => (
          <tr key={r.id} className="align-top hover:bg-gray-50/70">
            <td className="px-4 py-3">
              {r.product ? (
                <a
                  href={`/products/${r.product.handle}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-ink-dark hover:text-brand"
                  title="View product (opens new tab)"
                >
                  {r.product.title}
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.author}</td>
            <td className="px-4 py-3">
              <Stars rating={r.rating} />
            </td>
            <td className="max-w-xs px-4 py-3">
              <p className="line-clamp-2 text-gray-600" title={r.body}>
                {r.title && <span className="font-semibold text-ink-dark">{r.title} — </span>}
                {r.body}
              </p>
            </td>
            <td className="px-4 py-3">
              <form action={toggleReviewApprovedAction}>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  title={r.approved ? 'Approved — click to unapprove' : 'Pending — click to approve'}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    r.approved
                      ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${r.approved ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {r.approved ? 'Approved' : 'Pending'}
                </button>
              </form>
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-gray-500">{r.createdAt.toISOString().slice(0, 10)}</td>
            <td className="px-4 py-3">
              <form action={deleteReviewAction}>
                <input type="hidden" name="id" value={r.id} />
                <ConfirmSubmit
                  message={`Delete the review by ${r.author}? This cannot be undone.`}
                  title="Delete review"
                  className="text-gray-400 transition hover:text-red-600"
                >
                  <span className="sr-only">Delete</span>
                  <TrashIcon className="h-4 w-4" />
                </ConfirmSubmit>
              </form>
            </td>
          </tr>
        ))}
      </AdminTable>

      <Pager page={page} pages={pages} basePath="/admin/reviews" query={query} />
    </div>
  );
}
