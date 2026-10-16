'use client';

import { useEffect, useState } from 'react';
import { searchProductsForMoveAction, type MoveCandidate } from '@/app/admin/actions/product-layouts';
import { SearchIcon } from './icons';

const PAGE = 20;

/**
 * Searchable checklist of products (title, photo, current page layout), 20 at a time with "Show more". With
 * `layoutId`, only products using that layout are listed. Used by the Move products dialog's "Choose products".
 */
export function ProductChecklist({
  layoutId,
  selected,
  onChange,
}: {
  layoutId: number | null;
  selected: Set<number>;
  onChange: (next: Set<number>) => void;
}) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<MoveCandidate[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      searchProductsForMoveAction({ q, layoutId, skip: 0, take: PAGE })
        .then((r) => {
          if (cancelled) return;
          setItems(r.items);
          setTotal(r.total);
        })
        .catch(() => !cancelled && setItems([]));
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, layoutId]);

  const more = async () => {
    if (!items) return;
    setLoadingMore(true);
    try {
      const r = await searchProductsForMoveAction({ q, layoutId, skip: items.length, take: PAGE });
      setItems([...items, ...r.items.filter((x) => !items.some((y) => y.id === x.id))]);
      setTotal(r.total);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const allShown = !!items?.length && items.every((i) => selected.has(i.id));

  return (
    <div data-testid="product-checklist">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-semibold text-ink-dark" aria-live="polite">
          {selected.size} selected
        </span>
        {!!items?.length && (
          <button
            type="button"
            onClick={() => {
              const next = new Set(selected);
              for (const i of items) {
                if (allShown) next.delete(i.id);
                else next.add(i.id);
              }
              onChange(next);
            }}
            className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            {allShown ? 'Unselect all shown' : 'Select all shown'}
          </button>
        )}
      </div>
      <ul className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {items == null ? (
          <li className="px-3 py-4 text-sm text-gray-500">Loading…</li>
        ) : items.length === 0 ? (
          <li className="px-3 py-4 text-sm text-gray-500">No products found.</li>
        ) : (
          items.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-gray-50">
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="h-5 w-5 shrink-0 rounded border-gray-300" />
                {p.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image} alt="" className="h-10 w-10 shrink-0 rounded border border-gray-200 object-contain" />
                ) : (
                  <span className="h-10 w-10 shrink-0 rounded border border-dashed border-gray-300 bg-gray-50" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink-dark">{p.title}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {p.status === 'DRAFT' ? 'Draft · ' : p.status === 'ARCHIVED' ? 'Archived · ' : ''}
                    {p.layoutName}
                  </span>
                </span>
              </label>
            </li>
          ))
        )}
      </ul>
      {items && items.length < total && (
        <button
          type="button"
          onClick={more}
          disabled={loadingMore}
          className="mt-2 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {loadingMore ? 'Loading…' : `Show more (${total - items.length} more)`}
        </button>
      )}
    </div>
  );
}
