'use client';

import { SortableList } from '@/components/admin/SortableList';
import { FormError } from '@/components/admin/ui';
import { VARIANT_STATUSES, VARIANT_STATUS_COPY, type VariantStatus } from '@/lib/variant-status';
import type { OptionState, VariantState } from '../_lib/types';
import { comboLabel, priceTextError } from '../_lib/variants';

const inputCls =
  'min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500';

type Patch = (key: string, patch: Partial<VariantState>) => void;

function PriceInput({
  value,
  onChange,
  field,
  label,
  error,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  field: string;
  label: string;
  error: boolean;
  placeholder?: string;
}) {
  return (
    <input
      data-field={field}
      value={value}
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      aria-invalid={error || !!priceTextError(value) || undefined}
      placeholder={placeholder}
      maxLength={20}
      // kept as typed: a decimal point is never dropped silently (that turned 45,000.00 into 4,500,000)
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} ${error || priceTextError(value) ? 'border-red-400' : 'border-gray-300'}`}
    />
  );
}

function StatusSelect({ value, onChange, label, field }: { value: VariantStatus; onChange: (v: VariantStatus) => void; label: string; field: string }) {
  return (
    <select
      data-field={field}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as VariantStatus)}
      className={`${inputCls} border-gray-300`}
    >
      {VARIANT_STATUSES.map((s) => (
        <option key={s} value={s}>
          {VARIANT_STATUS_COPY[s].label}
        </option>
      ))}
    </select>
  );
}

/** The one-price form shown when a product has no options. */
function SingleVariant({ v, trackStock, onPatch, fieldError }: { v: VariantState; trackStock: boolean; onPatch: Patch; fieldError: (f: string) => string | null }) {
  const f = (n: string) => `variants.${v.key}.${n}`;
  return (
    <div data-testid="variant-row" data-variant-id={v.id ?? ''} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <span className={labelCls}>Regular price (Rs.)</span>
        <PriceInput value={v.regularPrice} onChange={(x) => onPatch(v.key, { regularPrice: x })} field={f('regularPrice')} label="Regular price" error={!!fieldError(f('regularPrice'))} placeholder="e.g. 45000" />
        <p className="mt-1 text-xs text-gray-400">Use 0 if the price is on request.</p>
        <FormError message={fieldError(f('regularPrice')) ?? priceTextError(v.regularPrice)} />
      </div>
      <div>
        <span className={labelCls}>Sale price (Rs.)</span>
        <PriceInput value={v.salePrice} onChange={(x) => onPatch(v.key, { salePrice: x })} field={f('salePrice')} label="Sale price" error={!!fieldError(f('salePrice'))} />
        <p className="mt-1 text-xs text-gray-400">Leave empty when it is not on sale.</p>
        <FormError message={fieldError(f('salePrice')) ?? priceTextError(v.salePrice)} />
      </div>
      <div>
        <span className={labelCls}>Status</span>
        <StatusSelect value={v.status} onChange={(s) => onPatch(v.key, { status: s })} label="Status" field={f('status')} />
        <p className="mt-1 text-xs text-gray-400">{VARIANT_STATUS_COPY[v.status].help}</p>
      </div>
      {trackStock && (
        <div>
          <span className={labelCls}>Stock</span>
          <input
            data-field={f('stock')}
            value={v.stock}
            inputMode="numeric"
            aria-label="Stock"
            onChange={(e) => onPatch(v.key, { stock: e.target.value.replace(/\D/g, '') })}
            className={`${inputCls} border-gray-300`}
          />
          <p className="mt-1 text-xs text-gray-400">For your records only; not shown on the store.</p>
          <FormError message={fieldError(f('stock'))} />
        </div>
      )}
    </div>
  );
}

/**
 * Every combination with its prices and status. Drag (or the arrows) to change the order the store lists
 * them in. Rows become cards below 640px.
 */
export function VariantsTable({
  options,
  variants,
  trackStock,
  selected,
  onToggleSelect,
  onToggleAll,
  onPatch,
  onReorder,
  onSortByOptionOrder,
  fieldError,
}: {
  options: OptionState[];
  variants: VariantState[];
  trackStock: boolean;
  selected: ReadonlySet<string>;
  onToggleSelect: (key: string) => void;
  onToggleAll: (on: boolean) => void;
  onPatch: Patch;
  onReorder: (variants: VariantState[]) => void;
  onSortByOptionOrder: () => void;
  fieldError: (field: string) => string | null;
}) {
  if (options.length === 0) {
    return variants[0] ? <SingleVariant v={variants[0]} trackStock={trackStock} onPatch={onPatch} fieldError={fieldError} /> : null;
  }

  const cols = trackStock
    ? 'sm:grid-cols-[minmax(0,1fr)_7.5rem_7.5rem_9.5rem_5.5rem_5rem]'
    : 'sm:grid-cols-[minmax(0,1fr)_8rem_8rem_10rem_5rem]';
  const allOn = variants.length > 0 && variants.every((v) => selected.has(v.key));

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {variants.length} combination{variants.length === 1 ? '' : 's'}
          {selected.size > 0 && <span className="font-semibold text-ink-dark"> · {selected.size} selected</span>}
        </p>
        <button type="button" onClick={onSortByOptionOrder} className="min-h-10 rounded-lg px-2 text-sm font-semibold text-brand-600 hover:underline">
          Sort by option order
        </button>
      </div>

      <div className={`hidden items-end gap-2 border-b border-gray-200 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:grid ${cols}`}>
        <label className="flex min-h-10 items-center gap-2 pl-10">
          <input
            type="checkbox"
            checked={allOn}
            onChange={(e) => onToggleAll(e.target.checked)}
            aria-label="Select all combinations"
            className="h-5 w-5 rounded border-gray-300"
          />
          Combination
        </label>
        <span>
          Regular price (Rs.)
          <span className="block text-[10px] font-normal normal-case tracking-normal text-gray-400">0 = price on request</span>
        </span>
        <span>Sale price (Rs.)</span>
        <span>Status</span>
        {trackStock && <span>Stock</span>}
        <span className="sr-only">Order</span>
      </div>

      <div className="mt-2">
        <SortableList
          items={variants}
          getKey={(v) => v.key}
          onReorder={onReorder}
          ariaLabel="Combinations"
          renderItem={(v, ctl) => {
            const label = comboLabel(options, v.valueKeys);
            const f = (n: string) => `variants.${v.key}.${n}`;
            const local = [
              ['Regular price', priceTextError(v.regularPrice)],
              ['Sale price', priceTextError(v.salePrice)],
            ].flatMap(([what, e]) => (e ? [`${what}: ${e}`] : []));
            const errs = [...['regularPrice', 'salePrice', 'stock'].map((n) => fieldError(f(n))).filter((e): e is string => !!e), ...local];
            return (
              <div
                data-testid="variant-row"
                data-variant-id={v.id ?? ''}
                data-field={`variants.${v.key}`}
                className={`rounded-xl border bg-white p-2 ${errs.length ? 'border-red-300' : 'border-gray-200'} ${ctl.dragging ? 'shadow-lg' : ''}`}
              >
                <div className={`grid grid-cols-2 items-center gap-2 ${cols}`}>
                  <div className="col-span-2 flex min-w-0 items-center gap-1 sm:col-span-1">
                    {ctl.handle}
                    <input
                      type="checkbox"
                      checked={selected.has(v.key)}
                      onChange={() => onToggleSelect(v.key)}
                      aria-label={`Select ${label}`}
                      className="h-5 w-5 shrink-0 rounded border-gray-300"
                    />
                    <span data-testid="variant-label" className="min-w-0 flex-1 truncate px-1 text-sm font-medium text-ink-dark" title={label}>
                      {label}
                    </span>
                    <span className="sm:hidden">{ctl.arrows}</span>
                  </div>
                  <label className="block">
                    <span className={`${labelCls} sm:sr-only`}>Regular price (Rs.)</span>
                    <PriceInput
                      value={v.regularPrice}
                      onChange={(x) => onPatch(v.key, { regularPrice: x })}
                      field={f('regularPrice')}
                      label={`Regular price for ${label}`}
                      error={!!fieldError(f('regularPrice'))}
                    />
                  </label>
                  <label className="block">
                    <span className={`${labelCls} sm:sr-only`}>Sale price (Rs.)</span>
                    <PriceInput
                      value={v.salePrice}
                      onChange={(x) => onPatch(v.key, { salePrice: x })}
                      field={f('salePrice')}
                      label={`Sale price for ${label}`}
                      error={!!fieldError(f('salePrice'))}
                    />
                  </label>
                  <label className={`block ${trackStock ? '' : 'col-span-2 sm:col-span-1'}`}>
                    <span className={`${labelCls} sm:sr-only`}>Status</span>
                    <StatusSelect value={v.status} onChange={(s) => onPatch(v.key, { status: s })} label={`Status for ${label}`} field={f('status')} />
                  </label>
                  {trackStock && (
                    <label className="block">
                      <span className={`${labelCls} sm:sr-only`}>Stock</span>
                      <input
                        data-field={f('stock')}
                        value={v.stock}
                        inputMode="numeric"
                        aria-label={`Stock for ${label}`}
                        onChange={(e) => onPatch(v.key, { stock: e.target.value.replace(/\D/g, '') })}
                        className={`${inputCls} ${fieldError(f('stock')) ? 'border-red-400' : 'border-gray-300'}`}
                      />
                    </label>
                  )}
                  <div className="hidden justify-end sm:flex">{ctl.arrows}</div>
                </div>
                {errs.map((e) => (
                  <FormError key={e} message={e} />
                ))}
              </div>
            );
          }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-400 sm:hidden">Use 0 for the regular price if the price is on request.</p>
    </div>
  );
}
