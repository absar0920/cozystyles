import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { markMessageAction, deleteMessageAction } from '@/app/admin/actions/messages';
import { AdminPageHeader, AdminTable, Badge, EmptyRow } from '@/components/admin/ui';
import { ChevronDown, ChevronLeft, ChevronRight, SearchIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Messages',
  robots: { index: false, follow: false },
};

const PER_PAGE = 20;
const STATUS_FILTERS = ['NEW', 'READ', 'CLOSED'] as const;

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';
  const status =
    typeof sp.status === 'string' && (STATUS_FILTERS as readonly string[]).includes(sp.status) ? sp.status : '';
  const page = Math.max(1, Number.parseInt(typeof sp.page === 'string' ? sp.page : '1', 10) || 1);
  const openRaw = Number.parseInt(typeof sp.open === 'string' ? sp.open : '', 10);
  const openId = Number.isFinite(openRaw) ? openRaw : null;

  const where: Prisma.ContactSubmissionWhereInput = {};
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { subject: { contains: q } },
    ];
  }

  const [total, grouped, items] = await Promise.all([
    prisma.contactSubmission.count({ where }),
    prisma.contactSubmission.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.contactSubmission.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  const countFor = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const allCount = grouped.reduce((n, g) => n + g._count._all, 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  /** Build a URL preserving current filters with optional overrides (null clears a param). */
  const href = (over: Record<string, string | number | null> = {}) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | null> = {
      q,
      status,
      page,
      open: openId,
      ...over,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v === null || v === undefined || v === '') continue;
      if (k === 'page' && Number(v) === 1) continue;
      p.set(k, String(v));
    }
    const s = p.toString();
    return s ? `/admin/messages?${s}` : '/admin/messages';
  };

  const tabs: { label: string; value: string; count: number }[] = [
    { label: 'All', value: '', count: allCount },
    { label: 'New', value: 'NEW', count: countFor('NEW') },
    { label: 'Read', value: 'READ', count: countFor('READ') },
    { label: 'Closed', value: 'CLOSED', count: countFor('CLOSED') },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Messages"
        subtitle="Contact form submissions from the storefront"
        actions={
          <form action="/admin/messages" method="get" className="flex items-center gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name, subject, email…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Search
            </button>
          </form>
        }
      />

      {/* ---------- Status filter tabs ---------- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = status === t.value;
          return (
            <Link
              key={t.label}
              href={href({ status: t.value || null, page: null, open: null })}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                active ? 'bg-brand-900 text-white' : 'border border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      <AdminTable head={['Name', 'Subject', 'Contact', 'Status', 'Date', '']}>
        {items.length === 0 ? (
          <EmptyRow colSpan={6} message={q || status ? 'No messages match your filters.' : 'No messages yet.'} />
        ) : (
          items.map((m) => {
            const isOpen = openId === m.id;
            return (
              <MessageRows key={m.id} m={m} isOpen={isOpen} href={href} />
            );
          })
        )}
      </AdminTable>

      {/* ---------- Pagination ---------- */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {page} of {pages} · {total.toLocaleString('en-PK')} message{total === 1 ? '' : 's'}
          </p>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={href({ page: page - 1, open: null })} className={ghostBtn}>
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Link>
            ) : (
              <span className={`${ghostBtn} cursor-not-allowed opacity-40`}>
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </span>
            )}
            {page < pages ? (
              <Link href={href({ page: page + 1, open: null })} className={ghostBtn}>
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

/* ---------------- Row renderer (summary row + optional expanded detail row) ---------------- */

type Message = Prisma.ContactSubmissionGetPayload<{}>;

function MessageRows({
  m,
  isOpen,
  href,
}: {
  m: Message;
  isOpen: boolean;
  href: (over?: Record<string, string | number | null>) => string;
}) {
  return (
    <>
      <tr className={`transition hover:bg-gray-50/70 ${isOpen ? 'bg-brand-50/50' : m.status === 'NEW' ? 'bg-amber-50/40' : ''}`}>
        <td className="px-4 py-3">
          <span className={`text-ink-dark ${m.status === 'NEW' ? 'font-semibold' : 'font-medium'}`}>{m.name}</span>
        </td>
        <td className="max-w-[220px] px-4 py-3">
          <span className="block truncate text-ink" title={m.subject || undefined}>
            {m.subject || <span className="text-gray-300">(no subject)</span>}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="block text-ink">{m.phone || <span className="text-gray-300">—</span>}</span>
          {m.email && <span className="block text-xs text-gray-400">{m.email}</span>}
        </td>
        <td className="px-4 py-3">
          <Badge>{m.status}</Badge>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-gray-500">{fmtDate(m.createdAt)}</td>
        <td className="px-4 py-3 text-right">
          <Link
            href={isOpen ? href({ open: null }) : href({ open: m.id })}
            aria-label={isOpen ? 'Collapse message' : 'Expand message'}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
              isOpen
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {isOpen ? 'Close' : 'View'}
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </Link>
        </td>
      </tr>

      {isOpen && (
        <tr>
          <td colSpan={6} className="border-l-4 border-brand bg-gray-50/80 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-heading text-sm font-bold text-ink-dark">
                  {m.subject || '(no subject)'}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  From {m.name}
                  {m.email && <> · {m.email}</>}
                  {m.phone && <> · {m.phone}</>} · {fmtDate(m.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {m.status !== 'READ' && (
                  <form action={markMessageAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value="READ" />
                    <button type="submit" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50">
                      Mark as Read
                    </button>
                  </form>
                )}
                {m.status !== 'CLOSED' && (
                  <form action={markMessageAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value="CLOSED" />
                    <button type="submit" className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50">
                      Mark as Closed
                    </button>
                  </form>
                )}
                <details className="relative inline-block text-left">
                  <summary className="inline-flex cursor-pointer select-none items-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 [&::-webkit-details-marker]:hidden">
                    Delete
                  </summary>
                  <div className="absolute right-0 z-10 mt-2 w-60 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                    <p className="text-xs text-gray-500">Permanently delete this message? This cannot be undone.</p>
                    <form action={deleteMessageAction} className="mt-2">
                      <input type="hidden" name="id" value={m.id} />
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
            </div>

            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-sm leading-relaxed text-ink">
              <p className="whitespace-pre-wrap">{m.message}</p>
            </div>

            {m.email && (
              <a
                href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || 'Your enquiry'}`)}`}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
              >
                Reply by email →
              </a>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
