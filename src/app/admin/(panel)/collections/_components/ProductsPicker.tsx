'use client';

import { useMemo, useState } from 'react';
import { SearchIcon } from '@/components/icons';

export type PickerProduct = { id: number; title: string; status: string };

const searchCls =
  'w-full rounded-lg border border-gray-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

/**
 * Searchable checkbox list of products. Controlled: the selected ids live in the parent, which also
 * writes them to the form (hidden `productsJson`).
 */
export function ProductsPicker({ products, value, onChange }: { products: PickerProduct[]; value: number[]; onChange: (ids: number[]) => void }) {
  const [query, setQuery] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const selected = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => (!onlySelected || selected.has(p.id)) && (!q || p.title.toLowerCase().includes(q)));
  }, [products, query, onlySelected, selected]);

  const toggle = (id: number) => onChange(selected.has(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products…"
            aria-label="Search products"
            className={searchCls}
          />
        </div>
        <button
          type="button"
          onClick={() => setOnlySelected((v) => !v)}
          aria-pressed={onlySelected}
          className={`min-h-10 whitespace-nowrap rounded-lg px-3 text-xs font-bold transition ${
            onlySelected ? 'bg-brand text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
          }`}
        >
          {value.length} selected{onlySelected ? ' · show all' : ''}
        </button>
      </div>
      <div className="max-h-96 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white">
        {filtered.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-gray-400">
            {products.length === 0 ? 'No products yet.' : onlySelected ? 'No products selected yet.' : 'No products match your search.'}
          </p>
        )}
        {filtered.slice(0, 200).map((p) => {
          const checked = selected.has(p.id);
          return (
            <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm transition hover:bg-gray-50">
              <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="h-5 w-5 shrink-0 accent-brand" />
              <span className={`min-w-0 flex-1 truncate font-medium ${checked ? 'text-brand-700' : 'text-ink-dark'}`}>{p.title}</span>
              {p.status !== 'ACTIVE' && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                  {p.status === 'DRAFT' ? 'Draft' : 'Archived'}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {filtered.length > 200 && <p className="mt-1.5 text-xs text-gray-400">Showing the first 200 — type in the search box to find more.</p>}
    </div>
  );
}
