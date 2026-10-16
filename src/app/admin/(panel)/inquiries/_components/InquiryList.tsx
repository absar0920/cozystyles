import Link from 'next/link';
import { formatRs } from '@/components/ui/Price';
import { ExternalLinkIcon } from '@/components/admin/icons';
import { formatStoreDateTime, timeAgo } from '@/lib/dates';
import { INQUIRY_KIND_LABEL, INQUIRY_KIND_STYLE, isInquiryKind, type InquiryView } from '../_lib/inquiries';

function KindBadge({ kind }: { kind: string }) {
  const known = isInquiryKind(kind);
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        known ? INQUIRY_KIND_STYLE[kind] : 'bg-gray-100 text-gray-600'
      }`}
    >
      {known ? INQUIRY_KIND_LABEL[kind] : kind}
    </span>
  );
}

function priceText(unitPrice: number | null): string {
  if (unitPrice == null) return '—';
  return unitPrice > 0 ? formatRs(unitPrice) : 'On request';
}

function ProductCell({ row }: { row: InquiryView }) {
  if (row.product) {
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5">
        <Link href={`/admin/products/${row.product.id}`} className="font-medium text-ink-dark hover:text-brand hover:underline">
          {row.product.title}
        </Link>
        <a
          href={`/products/${row.product.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`See “${row.product.title}” on the store`}
          title="See it on the store"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-brand"
        >
          <ExternalLinkIcon className="h-3.5 w-3.5" />
        </a>
      </span>
    );
  }
  if (row.productTitle) {
    return (
      <span className="text-gray-500">
        {row.productTitle} <span className="text-xs text-gray-400">(deleted)</span>
      </span>
    );
  }
  return <span className="text-gray-300">—</span>;
}

function When({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={formatStoreDateTime(date)} className="whitespace-nowrap">
      {timeAgo(date)}
    </time>
  );
}

/** WhatsApp inquiries as a table (640px and wider) or cards (phones). */
export function InquiryList({ rows, emptyMessage }: { rows: InquiryView[]; emptyMessage: string }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
        {emptyMessage}
      </div>
    );
  }
  return (
    <>
      {/* phones: cards */}
      <ul className="space-y-3 sm:hidden" data-testid="inquiry-cards">
        {rows.map((r) => (
          <li key={r.id} data-testid="inquiry-row" className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <KindBadge kind={r.kind} />
              <span className="text-xs text-gray-500">
                <When date={r.createdAt} />
              </span>
            </div>
            {(r.product || r.productTitle) && (
              <div className="mt-2 text-sm">
                <ProductCell row={r} />
              </div>
            )}
            {r.variantSummary && <p className="mt-1 text-xs text-gray-500">{r.variantSummary}</p>}
            {(r.kind === 'ORDER' || r.kind === 'AVAILABILITY') && (
              <p className="mt-1 text-xs text-gray-600">
                Qty {r.quantity} · {priceText(r.unitPrice)}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-400" title={r.pagePath || undefined}>
              From: {r.source}
            </p>
          </li>
        ))}
      </ul>

      {/* 640px and wider: table */}
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              {['When', 'Type', 'Product', 'Options', 'Qty', 'Price', 'From'].map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.id} data-testid="inquiry-row" className="align-top transition hover:bg-gray-50/70">
                <td className="px-4 py-3 text-gray-500">
                  <When date={r.createdAt} />
                </td>
                <td className="px-4 py-3">
                  <KindBadge kind={r.kind} />
                </td>
                <td className="px-4 py-3">
                  <ProductCell row={r} />
                </td>
                <td className="px-4 py-3 text-gray-600">{r.variantSummary || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-3 text-gray-600">{r.kind === 'ORDER' || r.kind === 'AVAILABILITY' ? r.quantity : '—'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-600">{priceText(r.unitPrice)}</td>
                <td className="px-4 py-3 text-gray-500" title={r.pagePath || undefined}>
                  {r.source}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
