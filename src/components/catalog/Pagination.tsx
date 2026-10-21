import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { catalogHref } from './filters';

function pageWindow(page: number, pages: number): (number | 'dots')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set<number>([1, pages, page - 1, page, page + 1]);
  if (page <= 3) {
    keep.add(4);
    keep.add(5);
  } else if (page >= pages - 2) {
    keep.add(pages - 4);
    keep.add(pages - 3);
  } else {
    keep.add(2);
    keep.add(pages - 1);
  }
  const nums = [...keep].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | 'dots')[] = [];
  let prev = 0;
  for (const n of nums) {
    if (prev && n - prev > 1) out.push('dots');
    out.push(n);
    prev = n;
  }
  return out;
}

/**
 * Filter-preserving pagination. `params` holds the current query params
 * (without `page`); only `?page=N` is added (and omitted on page 1).
 */
export function Pagination({
  page,
  pages,
  basePath,
  params,
  className,
}: {
  page: number;
  pages: number;
  basePath: string;
  params: Record<string, string | undefined>;
  className?: string;
}) {
  if (pages <= 1) return null;
  const items = pageWindow(page, pages);
  const baseBtn =
    'inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-md border px-2 text-sm font-medium transition';
  const idleBtn = `${baseBtn} border-cream-border bg-white text-ink-dark hover:border-brand hover:text-brand`;
  const disabledBtn = `${baseBtn} cursor-not-allowed border-cream-border bg-cream-soft text-ink-light`;

  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center justify-center gap-1.5 ${className ?? ''}`}>
      {page > 1 ? (
        <Link href={catalogHref(basePath, params, page - 1)} rel="prev" aria-label="Previous page" className={idleBtn}>
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${disabledBtn} opacity-60`} aria-hidden>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {items.map((item, i) =>
        item === 'dots' ? (
          <span key={`dots-${i}`} className="px-1 text-sm text-ink-light" aria-hidden>
            …
          </span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={`${baseBtn} border-brand bg-brand text-white shadow-card`}>
            {item}
          </span>
        ) : (
          <Link key={item} href={catalogHref(basePath, params, item)} className={idleBtn} aria-label={`Page ${item}`}>
            {item}
          </Link>
        ),
      )}

      {page < pages ? (
        <Link href={catalogHref(basePath, params, page + 1)} rel="next" aria-label="Next page" className={idleBtn}>
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={`${disabledBtn} opacity-60`} aria-hidden>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
