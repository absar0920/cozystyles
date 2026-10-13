'use client';

import Link from 'next/link';
import { FilterIcon } from '@/components/icons';
import { catalogHref } from './filters';

const SORT_OPTIONS = [
  { value: '', label: 'Featured' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'title-asc', label: 'Alphabetical: A–Z' },
];

export type FilterBarProps = {
  /** Path the GET form submits to, e.g. `/collections/bedroom` or `/search`. */
  basePath: string;
  /** Preserved via a hidden input (search page). */
  q?: string;
  sort?: string;
  min?: number;
  max?: number;
  stock?: boolean;
};

/**
 * Catalog filter bar — sort select (auto-submits), price min/max, in-stock
 * toggle and Apply. Submitted as a plain GET form so filters are shareable
 * URLs; submitting always resets back to page 1.
 */
export function FilterBar({ basePath, q, sort, min, max, stock }: FilterBarProps) {
  const hasFilters = Boolean(sort || min != null || max != null || stock);
  const clearHref = catalogHref(basePath, q ? { q } : {});

  return (
    <form method="get" action={basePath} className="rounded-xl border border-cream-border bg-white p-4 shadow-card sm:p-5">
      {q ? <input type="hidden" name="q" value={q} /> : null}
      <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <div className="flex items-center gap-2 pb-2.5">
          <FilterIcon className="h-4 w-4 text-brand" />
          <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Filter &amp; Sort</span>
        </div>

        <div className="w-full sm:w-52">
          <label htmlFor="filter-sort" className="label">
            Sort by
          </label>
          <select
            id="filter-sort"
            name="sort"
            defaultValue={sort ?? ''}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="input cursor-pointer !py-2"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="label" id="filter-price-label">
            Price (Rs.)
          </span>
          <div className="flex items-center gap-2" aria-labelledby="filter-price-label">
            <input
              type="number"
              name="min"
              min={0}
              step={1000}
              inputMode="numeric"
              defaultValue={min ?? ''}
              placeholder="Min"
              aria-label="Minimum price in rupees"
              className="input w-24 !py-2"
            />
            <span className="pb-1.5 text-ink-light">–</span>
            <input
              type="number"
              name="max"
              min={0}
              step={1000}
              inputMode="numeric"
              defaultValue={max ?? ''}
              placeholder="Max"
              aria-label="Maximum price in rupees"
              className="input w-24 !py-2"
            />
          </div>
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2 pb-2.5 text-sm text-ink-dark">
          <input
            type="checkbox"
            name="stock"
            value="1"
            defaultChecked={stock}
            className="h-4 w-4 cursor-pointer rounded accent-brand"
          />
          In stock only
        </label>

        <div className="flex items-center gap-3 pb-1.5">
          <button type="submit" className="btn-primary !px-5 !py-2">
            Apply
          </button>
          {hasFilters && (
            <Link
              href={clearHref}
              className="text-xs font-semibold text-ink-muted underline underline-offset-2 transition hover:text-brand"
            >
              Clear all
            </Link>
          )}
        </div>
      </div>
    </form>
  );
}
