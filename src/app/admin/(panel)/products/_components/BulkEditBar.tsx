'use client';

import { forwardRef, useState } from 'react';
import { VARIANT_STATUSES, VARIANT_STATUS_COPY, type VariantStatus } from '@/lib/variant-status';
import type { OptionState } from '../_lib/types';
import { priceTextError, type BulkFields, type BulkTarget } from '../_lib/variants';

const inputCls =
  'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500';

export function encodeTarget(t: BulkTarget): string {
  return t.kind === 'value' ? `v:${t.valueKey}` : t.kind;
}
function decodeTarget(s: string): BulkTarget {
  if (s.startsWith('v:')) return { kind: 'value', valueKey: s.slice(2) };
  return s === 'selected' ? { kind: 'selected' } : { kind: 'all' };
}

/**
 * "Change many at once": pick which combinations (all, the ticked ones, or every combination with one value),
 * fill only the fields to change, Apply. The regular-price input is focusable from outside (ref) for the
 * "Set all prices" / "Apply prices to all <value>" shortcuts.
 */
export const BulkEditBar = forwardRef<
  HTMLInputElement,
  {
    options: OptionState[];
    selectedCount: number;
    target: BulkTarget;
    onTarget: (t: BulkTarget) => void;
    /** returns how many combinations changed */
    onApply: (f: BulkFields) => number;
  }
>(function BulkEditBar({ options, selectedCount, target, onTarget, onApply }, ref) {
  const [regular, setRegular] = useState('');
  const [sale, setSale] = useState('');
  const [clearSale, setClearSale] = useState(false);
  const [status, setStatus] = useState<VariantStatus | ''>('');
  const [done, setDone] = useState<string | null>(null);
  const nothing = !regular.trim() && !sale.trim() && !clearSale && !status;
  const regularError = priceTextError(regular);
  const saleError = clearSale ? null : priceTextError(sale);

  const apply = () => {
    if (nothing) {
      setDone('Fill in at least one field to change.');
      return;
    }
    if (regularError || saleError) {
      setDone('Fix the price first: whole rupees only, e.g. 45000.');
      return;
    }
    const n = onApply({ regularPrice: regular, salePrice: sale, clearSale, status });
    setDone(n ? `Updated ${n} combination${n === 1 ? '' : 's'}. Remember to save.` : 'No combinations match that choice.');
    setRegular('');
    setSale('');
    setClearSale(false);
    setStatus('');
  };

  return (
    <div data-testid="bulk-edit" className="rounded-xl border border-brand-100 bg-brand-50/50 p-3 sm:p-4">
      <p className="text-sm font-semibold text-ink-dark">Change many at once</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className={labelCls}>Apply to</span>
          <select
            aria-label="Apply to"
            value={encodeTarget(target)}
            onChange={(e) => {
              onTarget(decodeTarget(e.target.value));
              setDone(null);
            }}
            className={inputCls}
          >
            <option value="all">All combinations</option>
            <option value="selected" disabled={selectedCount === 0}>
              Selected ({selectedCount})
            </option>
            {options.map((o) => (
              <optgroup key={o.key} label={o.name || 'Option'}>
                {o.values.map((v) => (
                  <option key={v.key} value={`v:${v.key}`}>
                    Every “{v.value}”
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Regular price (Rs.)</span>
          <input
            ref={ref}
            aria-label="New regular price"
            value={regular}
            inputMode="numeric"
            maxLength={20}
            aria-invalid={!!regularError || undefined}
            onChange={(e) => setRegular(e.target.value)}
            placeholder="Leave empty to keep"
            className={`${inputCls} ${regularError ? '!border-red-400' : ''}`}
          />
          {regularError && <span className="mt-1 block text-xs font-medium text-red-600">{regularError}</span>}
        </label>
        <div>
          <label className="block">
            <span className={labelCls}>Sale price (Rs.)</span>
            <input
              aria-label="New sale price"
              value={sale}
              disabled={clearSale}
              inputMode="numeric"
              maxLength={20}
              aria-invalid={!!saleError || undefined}
              onChange={(e) => setSale(e.target.value)}
              placeholder="Leave empty to keep"
              className={`${inputCls} disabled:bg-gray-100 ${saleError ? '!border-red-400' : ''}`}
            />
            {saleError && <span className="mt-1 block text-xs font-medium text-red-600">{saleError}</span>}
          </label>
          <label className="mt-1 flex min-h-8 items-center gap-2 text-xs text-gray-600">
            <input type="checkbox" checked={clearSale} onChange={(e) => setClearSale(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Clear the sale price
          </label>
        </div>
        <label className="block">
          <span className={labelCls}>Status</span>
          <select aria-label="New status" value={status} onChange={(e) => setStatus(e.target.value as VariantStatus | '')} className={inputCls}>
            <option value="">Don’t change</option>
            {VARIANT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VARIANT_STATUS_COPY[s].label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={apply}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-900 px-5 text-sm font-semibold text-white hover:bg-brand lg:mt-[22px]"
        >
          Apply
        </button>
      </div>
      {done && (
        <p role="status" className="mt-2 text-xs font-medium text-brand-800">
          {done}
        </p>
      )}
    </div>
  );
});
