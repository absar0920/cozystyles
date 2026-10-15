import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { catalogHref, type ParamList } from './filters';

/** Shopify `default_pagination` window: first, current ± 2, last, with "…" for gaps. */
function pageWindow(page: number, pages: number): (number | 'dots')[] {
  const keep = new Set<number>([1, pages]);
  for (let n = page - 2; n <= page + 2; n++) if (n >= 1 && n <= pages) keep.add(n);
  const out: (number | 'dots')[] = [];
  let prev = 0;
  for (const n of [...keep].sort((a, b) => a - b)) {
    if (prev && n - prev > 1) out.push('dots');
    out.push(n);
    prev = n;
  }
  return out;
}

/** Live's Poppins subset has no arrows, so the browser falls back to the generic sans-serif glyph. */
function Arrow({ children }: { children: ReactNode }) {
  return <span className="[font-family:sans-serif]">{children}</span>;
}

const circle =
  'mx-[3px] inline-flex h-[42px] w-[42px] items-center justify-center rounded-full border border-accent align-middle text-[13px] leading-none';

/**
 * Live numbered `.pagination .page-numbers` (search): 42px circles, current page in accent2,
 * "←" / "→" circles for prev / next. `params` = current query params (without page).
 */
export function Pagination({
  page,
  pages,
  basePath,
  params,
  className = '',
}: {
  page: number;
  pages: number;
  basePath: string;
  params: ParamList;
  className?: string;
}) {
  if (pages <= 1) return null;
  const link = `${circle} text-accent hover:bg-accent hover:text-white`;
  const items: ReactNode[] = [];
  if (page > 1) {
    items.push(
      <Link key="prev" href={catalogHref(basePath, params, page - 1)} rel="prev" aria-label="Previous page" className={link}>
        <Arrow>←</Arrow>
      </Link>,
    );
  }
  pageWindow(page, pages).forEach((item, i) =>
    items.push(
      item === 'dots' ? (
        <span key={`dots-${i}`} className="align-middle" aria-hidden>
          …
        </span>
      ) : item === page ? (
        <span key={item} aria-current="page" className={`${circle} border-accent2 text-accent2`}>
          {item}
        </span>
      ) : (
        <Link key={item} href={catalogHref(basePath, params, item)} aria-label={`Page ${item}`} className={link}>
          {item}
        </Link>
      ),
    ),
  );
  if (page < pages) {
    items.push(
      <Link key="next" href={catalogHref(basePath, params, page + 1)} rel="next" aria-label="Next page" className={link}>
        <Arrow>→</Arrow>
      </Link>,
    );
  }
  // Live separates the inline items with whitespace (≈4.5px at the 17px body size): 52.5px pitch.
  return (
    <nav aria-label="Pagination" className={`relative block min-h-[42px] text-center text-[17px] leading-[29.75px] ${className}`}>
      {items.map((node, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          {node}
        </Fragment>
      ))}
    </nav>
  );
}
