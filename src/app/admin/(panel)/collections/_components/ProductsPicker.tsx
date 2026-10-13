'use client';

import { useMemo, useState } from 'react';
import { SearchIcon } from '@/components/icons';

export type PickerProduct = { id: number; title: string; handle: string };

const searchCls =
  'w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

/**
 * Searchable checkbox list of products; selected ids are serialized to the
 * hidden `productsJson` input (kept in sync via React state re-render).
 */
export function ProductsPicker({ products, initialIds = [] }: { products: PickerProduct[]; initialIds?: number[] }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number[]>(initialIds);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q) || p.handle.toLowerCase().includes(q));
  }, [products, query]);

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <input type="hidden" name="productsJson" value={JSON.stringify(selected)} />
      <div className="mb-2 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products by title or handle…"
            className={searchCls}
          />
        </div>
        <span className="whitespace-nowrap rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-bold text-brand-700">
          {selected.length} selected
        </span>
      </div>
      <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white">
        {filtered.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-gray-400">
            {products.length === 0 ? 'No products yet.' : 'No products match your search.'}
          </p>
        )}
        {filtered.slice(0, 200).map((p) => {
          const checked = selected.includes(p.id);
          return (
            <label key={p.id} className="flex cursor-pointer items-start gap-2.5 px-3 py-2 text-sm transition hover:bg-gray-50">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(p.id)}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-medium ${checked ? 'text-brand-700' : 'text-ink-dark'}`}>{p.title}</span>
                <span className="block truncate font-mono text-[11px] text-gray-400">{p.handle}</span>
              </span>
            </label>
          );
        })}
      </div>
      {filtered.length > 200 && (
        <p className="mt-1.5 text-xs text-gray-400">Showing the first 200 matches — refine your search to see more.</p>
      )}
    </div>
  );
}
