/** Shared admin pagination — numbered window + prev/next, built on ?page= links. Server-safe. */
export function Pager({
  page,
  pages,
  basePath,
  query = {},
}: {
  page: number;
  pages: number;
  basePath: string;
  query?: Record<string, string>;
}) {
  if (pages <= 1) return null;

  const href = (p: number) => {
    const params = new URLSearchParams(query);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const items: (number | '…')[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) items.push(i);
    else if (items[items.length - 1] !== '…') items.push('…');
  }

  const baseBtn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2.5 text-sm font-medium transition';

  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      <p className="text-xs text-gray-500">
        Page <span className="font-semibold text-ink-dark">{page}</span> of {pages}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {page > 1 ? (
          <a href={href(page - 1)} className={`${baseBtn} border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand`}>
            ‹ Prev
          </a>
        ) : (
          <span className={`${baseBtn} pointer-events-none border-gray-100 bg-gray-50 text-gray-300`}>‹ Prev</span>
        )}
        {items.map((item, i) =>
          item === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-sm text-gray-400">
              …
            </span>
          ) : item === page ? (
            <span key={item} aria-current="page" className={`${baseBtn} border-brand bg-brand text-white`}>
              {item}
            </span>
          ) : (
            <a key={item} href={href(item)} className={`${baseBtn} border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand`}>
              {item}
            </a>
          ),
        )}
        {page < pages ? (
          <a href={href(page + 1)} className={`${baseBtn} border-gray-200 bg-white text-gray-600 hover:border-brand hover:text-brand`}>
            Next ›
          </a>
        ) : (
          <span className={`${baseBtn} pointer-events-none border-gray-100 bg-gray-50 text-gray-300`}>Next ›</span>
        )}
      </div>
    </nav>
  );
}
