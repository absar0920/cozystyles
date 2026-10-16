'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { searchCollectionsAction, type CollectionChoice } from '@/app/admin/actions/collections';
import { Popover } from './Popover';
import { SearchIcon, WarningIcon } from './icons';

export type PickedCollection = { id: number; title: string; products?: number };

/** Choose one collection by name (search popover; a bottom sheet on phones). Never shows web addresses. */
export function CollectionPicker({
  value,
  onChange,
  label,
  hint,
  required,
  missing,
  error,
}: {
  value: PickedCollection | null;
  onChange: (c: PickedCollection) => void;
  label: string;
  hint?: string;
  required?: boolean;
  /** the stored collection was deleted */
  missing?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CollectionChoice[] | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => {
      searchCollectionsAction(q)
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, open]);

  const bad = missing || !!error;
  return (
    <div data-testid="collection-picker">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={`${id}-btn`} className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </label>
        {required && <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Required</span>}
      </div>
      <button
        id={`${id}-btn`}
        ref={ref}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setQ('');
          setOpen((o) => !o);
        }}
        className={`flex min-h-11 w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition hover:border-brand-400 ${
          bad ? 'border-red-300' : 'border-gray-300'
        }`}
      >
        {missing && <WarningIcon className="h-4 w-4 shrink-0 text-red-500" />}
        <span data-testid="collection-picker-value" className={`min-w-0 flex-1 truncate ${missing ? 'font-medium text-red-600' : value ? 'text-ink-dark' : 'text-gray-400'}`}>
          {missing ? 'The collection was deleted — pick another' : value ? `Collection · ${value.title}` : 'Choose a collection'}
        </span>
        <span className="shrink-0 text-xs font-semibold text-brand-600">{value ? 'Change' : 'Choose'}</span>
      </button>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      <Popover open={open} anchorRef={ref} onClose={() => setOpen(false)} title="Choose a collection" width={380} testId="collection-picker-popover">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search collections…"
            aria-label="Search collections"
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        <ul className="mt-2 min-h-24" aria-live="polite">
          {results == null ? (
            <li className="px-1 py-3 text-sm text-gray-500">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-1 py-3 text-sm text-gray-500">No collection found. Try another word.</li>
          ) : (
            results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  data-testid="collection-result"
                  onClick={() => {
                    onChange({ id: c.id, title: c.title, products: c.products });
                    setOpen(false);
                    ref.current?.focus();
                  }}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-gray-50 ${
                    value?.id === c.id ? 'bg-brand-50' : ''
                  }`}
                >
                  <span className="truncate">{c.title}</span>
                  <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                    {c.products} product{c.products === 1 ? '' : 's'}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </Popover>
    </div>
  );
}
