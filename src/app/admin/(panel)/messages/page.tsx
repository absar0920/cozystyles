import type { Metadata } from 'next';
import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { markMessageAction, deleteMessageAction } from '@/app/admin/actions/messages';
import { AdminPageHeader, AdminTable, Badge, EmptyRow, Notice, Tabs } from '@/components/admin/ui';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { ChevronDown, ChevronLeft, ChevronRight, SearchIcon } from '@/components/icons';
import { ToastLink } from '@/components/toast/ToastLink';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Messages',
  robots: { index: false, follow: false },
};

const PER_PAGE = 20;
const STATUS_FILTERS = ['NEW', 'READ', 'CLOSED'] as const;
/** Subject the footer "Join our mailing list" box stores its sign-ups under (src/app/api/contact/route.ts). */
const NEWSLETTER = 'Newsletter';
/** ?type=: '' everything, 'messages' = all but newsletter sign-ups, 'newsletter' = only sign-ups. */
const TYPE_FILTERS = ['messages', 'newsletter'] as const;

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

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
  const type = typeof sp.type === 'string' && (TYPE_FILTERS as readonly string[]).includes(sp.type) ? sp.type : '';
  const openRaw = Number.parseInt(typeof sp.open === 'string' ? sp.open : '', 10);
  const openId = Number.isFinite(openRaw) ? openRaw : null;

  const typeWhere: Prisma.ContactSubmissionWhereInput =
    type === 'newsletter' ? { subject: NEWSLETTER } : type === 'messages' ? { NOT: { subject: NEWSLETTER } } : {};
  const where: Prisma.ContactSubmissionWhereInput = { ...typeWhere };
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
      { subject: { contains: q } },
    ];
  }

  const [total, grouped, items, signups] = await Promise.all([
    prisma.contactSubmission.count({ where }),
    prisma.contactSubmission.groupBy({
      by: ['status'],
      where: typeWhere,
      _count: { _all: true },
    }),
    prisma.contactSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
    prisma.contactSubmission.count({ where: { subject: NEWSLETTER } }),
  ]);

  const countFor = (s: string) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const allCount = grouped.reduce((n, g) => n + g._count._all, 0);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  /** Build a URL preserving current filters with optional overrides (null clears a param). */
  const href = (over: Record<string, string | number | null> = {}) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | number | null> = {
      q,
      type,
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

  const typeTabs = [
    { label: 'Everything', value: '', hint: '' },
    { label: 'Messages', value: 'messages', hint: 'Sent with the forms on the store, such as the Contact us page.' },
    { label: `Newsletter sign-ups (${signups.toLocaleString('en-PK')})`, value: 'newsletter', hint: '' },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Messages"
        subtitle="Messages customers send from the store, and newsletter sign-ups"
        actions={
          <form action="/admin/messages" method="get" className="flex w-full items-center gap-2 sm:w-auto">
            {type && <input type="hidden" name="type" value={type} />}
            {status && <input type="hidden" name="status" value={status} />}
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name, subject, email…"
                className="min-h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-300 focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-72"
              />
            </div>
            <button
              type="submit"
              className="min-h-10 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
            >
              Search
            </button>
          </form>
        }
      />

      <Tabs
        ariaLabel="Kind of message"
        items={typeTabs.map((t) => ({
          label: t.label,
          href: href({ type: t.value || null, status: null, page: null, open: null }),
          active: type === t.value,
          hint: t.hint,
        }))}
      />

      {type === 'newsletter' && (
        <div className="mb-4">
          <Notice
            tone="info"
            title="There is no mailing list"
            action={
              signups > 0 ? (
                <ToastLink href="/admin/messages/newsletter-signups" download toastMessage="Download started" className={`${ghostBtn} min-h-10`}>
                  Download sign-ups (CSV)
                </ToastLink>
              ) : undefined
            }
          >
            These are the email addresses typed into “Join our mailing list” at the bottom of the store. The shop has no
            mailing service, so nothing is ever sent to them. Sign-ups are only collected here. To send news, download
            the list and use your own email or a mailing service.
          </Notice>
        </div>
      )}

      {/* ---------- Status filter tabs ---------- */}
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = status === t.value;
          return (
            <Link
              key={t.label}
              href={href({ status: t.value || null, page: null, open: null })}
              className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
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

      <ul className="space-y-3 sm:hidden">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-400">
            {emptyText(q, status, type)}
          </li>
        ) : (
          items.map((m) => <MessageCard key={m.id} m={m} isOpen={openId === m.id} href={href} />)
        )}
      </ul>

      <div className="hidden sm:block">
        <AdminTable head={['Name', 'Subject', 'Contact', 'Status', 'Date', '']}>
          {items.length === 0 ? (
            <EmptyRow colSpan={6} message={emptyText(q, status, type)} />
          ) : (
            items.map((m) => {
              const isOpen = openId === m.id;
              return <MessageRows key={m.id} m={m} isOpen={isOpen} href={href} />;
            })
          )}
        </AdminTable>
      </div>

      {/* ---------- Pagination ---------- */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {page} of {pages} · {total.toLocaleString('en-PK')} message
            {total === 1 ? '' : 's'}
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

function emptyText(q: string, status: string, type: string): string {
  if (q || status) return 'No messages match your filters.';
  return type === 'newsletter' ? 'No newsletter sign-ups yet.' : 'No messages yet.';
}

/** "The message from Ali (ali@x.pk), received 3 Oct 2026, and its text" */
function deleteConsequence(m: { name: string; email: string; createdAt: Date }): string {
  return `The message from ${m.name}${m.email ? ` (${m.email})` : ''}, received ${fmtDate(m.createdAt)}, and its text`;
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
      <tr
        className={`transition hover:bg-gray-50/70 ${isOpen ? 'bg-brand-50/50' : m.status === 'NEW' ? 'bg-amber-50/40' : ''}`}
      >
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
            <MessageDetail m={m} />
          </td>
        </tr>
      )}
    </>
  );
}

function MessageDetail({ m }: { m: Message }) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-sm font-bold text-ink-dark">{m.subject || '(no subject)'}</p>
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
              <button
                type="submit"
                className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Mark as Read
              </button>
            </form>
          )}
          {m.status !== 'CLOSED' && (
            <form action={markMessageAction}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="status" value="CLOSED" />
              <button
                type="submit"
                className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Mark as Closed
              </button>
            </form>
          )}
          <ConfirmDelete
            action={deleteMessageAction}
            fields={{ id: String(m.id) }}
            title="Delete this message?"
            consequences={[deleteConsequence(m)]}
          />
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
    </>
  );
}

/** Phones (below 640px): one card per message; the open one shows its text and actions. */
function MessageCard({
  m,
  isOpen,
  href,
}: {
  m: Message;
  isOpen: boolean;
  href: (over?: Record<string, string | number | null>) => string;
}) {
  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm ${isOpen ? 'border-brand-300' : m.status === 'NEW' ? 'border-amber-200' : 'border-gray-200'}`}
    >
      <Link href={isOpen ? href({ open: null }) : href({ open: m.id })} className="block">
        <div className="flex items-center justify-between gap-2">
          <span className={`min-w-0 truncate text-ink-dark ${m.status === 'NEW' ? 'font-semibold' : 'font-medium'}`}>
            {m.name}
          </span>
          <Badge>{m.status}</Badge>
        </div>
        <p className="mt-1 truncate text-sm text-ink">
          {m.subject || <span className="text-gray-300">(no subject)</span>}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {[m.phone, m.email, fmtDate(m.createdAt)].filter(Boolean).join(' · ')}
        </p>
        <span className="mt-2 inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-brand">
          {isOpen ? 'Close' : 'Read message'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </Link>
      {isOpen && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <MessageDetail m={m} />
        </div>
      )}
    </li>
  );
}
