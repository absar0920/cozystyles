'use client';

import { useEffect, useId, useState } from 'react';
import { CheckboxField, Field, FormError, SectionCard, Select, TextInput } from '@/components/admin/ui';
import { ChipsInput } from '@/components/admin/ChipsInput';
import { slugify } from '@/lib/slug';
import { useSiteHost } from '@/lib/use-site-host';
import { DISCOUNT_GROUPS, type ProductEditorState, type VariantState } from '../_lib/types';
import { comboLabel } from '../_lib/variants';

const cellCls = 'min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

const gramsToKg = (g: string) => (g.trim() === '' ? '' : String(Math.round(Number(g)) / 1000));

/** Weight shown in kg (up to 2 decimals in the hint), stored as whole grams. */
function WeightInput({ grams, onChange, label, field, error }: { grams: string; onChange: (g: string) => void; label: string; field: string; error: boolean }) {
  const [text, setText] = useState(() => gramsToKg(grams));
  // follow outside changes (e.g. the state reloaded after a save) without fighting the user's typing
  useEffect(() => {
    const mine = text.trim() === '' ? '' : String(Math.round(Number(text) * 1000));
    if (mine !== grams) setText(gramsToKg(grams));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grams]);
  return (
    <input
      data-field={field}
      value={text}
      inputMode="decimal"
      aria-label={label}
      placeholder="0"
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        if (!/^\d*\.?\d{0,3}$/.test(t)) return;
        setText(t);
        onChange(t === '' || t === '.' ? '' : String(Math.round(Number(t) * 1000)));
      }}
      className={`${cellCls} ${error ? 'border-red-400' : 'border-gray-300'}`}
    />
  );
}

/** Technical fields, collapsed by default: web address, brand, type, search keywords, discount group, stock, SKU/weight. */
export function AdvancedSection({
  state,
  savedHandle,
  productTypes,
  onChange,
  onPatchVariant,
  fieldError,
}: {
  state: ProductEditorState;
  /** the handle stored in the database (null for a new product) */
  savedHandle: string | null;
  productTypes: string[];
  onChange: (patch: Partial<ProductEditorState>) => void;
  onPatchVariant: (key: string, patch: Partial<VariantState>) => void;
  fieldError: (field: string) => string | null;
}) {
  const typesId = useId();
  const host = useSiteHost();
  const handleChanged = savedHandle != null && slugify(state.handle) !== savedHandle;

  return (
    <SectionCard id="advanced" title="Advanced" description="Web address, SKU, weight and other details. Filled in automatically — change only if you need to." collapsible defaultOpen={false}>
      <div className="space-y-5">
        <div>
          <label htmlFor="product-handle" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Web address
          </label>
          <div
            className={`flex min-h-11 items-center overflow-hidden rounded-lg border bg-white focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 ${
              fieldError('handle') ? 'border-red-400' : 'border-gray-300'
            }`}
          >
            <span className="hidden shrink-0 select-none bg-gray-50 px-3 py-2.5 text-sm text-gray-500 sm:inline">{host}/products/</span>
            <span className="shrink-0 select-none bg-gray-50 px-2 py-2.5 text-sm text-gray-500 sm:hidden">…/products/</span>
            <input
              id="product-handle"
              data-field="handle"
              value={state.handle}
              onChange={(e) => onChange({ handle: e.target.value.toLowerCase().replace(/\s+/g, '-'), handleTouched: true })}
              onBlur={() => state.handle && onChange({ handle: slugify(state.handle) })}
              className="min-w-0 flex-1 border-0 px-2 py-2 text-sm outline-none focus:ring-0"
            />
          </div>
          {handleChanged ? (
            <p role="alert" className="mt-1 text-xs font-medium text-amber-700">
              Changing the web address breaks links that people have saved or shared.
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-400">Made from the title. Letters, numbers and dashes only.</p>
          )}
          <FormError message={fieldError('handle')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand" htmlFor="product-vendor" hint="Shown to Google as the maker.">
            <TextInput id="product-vendor" value={state.vendor} maxLength={100} onChange={(e) => onChange({ vendor: e.target.value })} />
          </Field>
          <Field label="Product type" htmlFor="product-type" hint="e.g. Sofa, Bed, Chair. Helps the store search.">
            <TextInput id="product-type" list={typesId} value={state.productType} maxLength={100} onChange={(e) => onChange({ productType: e.target.value })} />
            <datalist id={typesId}>
              {productTypes.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
        </div>

        <div data-field="tags">
          <ChipsInput
            label="Search keywords"
            ariaLabel="Search keywords"
            value={state.tags}
            onChange={(tags) => onChange({ tags })}
            hint="Extra words that help the store search find this product."
            placeholder="Type a word and press Enter"
          />
          <FormError message={fieldError('tags')} />
        </div>

        <Field label="Discount filter group" htmlFor="product-discount" hint="Puts the product under this choice in the phone “Discount %” filter.">
          <Select
            id="product-discount"
            value={state.discountGroup == null ? '' : String(state.discountGroup)}
            onChange={(e) => onChange({ discountGroup: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">None</option>
            {DISCOUNT_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}%
              </option>
            ))}
          </Select>
        </Field>

        <CheckboxField
          label="Track stock count"
          hint="Adds a Stock column to the combinations, for your own records. The store never shows it."
          checked={state.trackStock}
          onChange={(v) => onChange({ trackStock: v })}
        />

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">SKU and weight</p>
          <p className="mb-2 text-xs text-gray-400">Leave SKU empty and we make one for you.</p>
          <div className="space-y-2">
            <div className="hidden grid-cols-[minmax(0,1fr)_10rem_7rem] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:grid">
              <span>Combination</span>
              <span>SKU</span>
              <span>Weight (kg)</span>
            </div>
            {state.variants.map((v) => {
              const label = comboLabel(state.options, v.valueKeys);
              const sf = `variants.${v.key}.sku`;
              const wf = `variants.${v.key}.weightGrams`;
              return (
                <div key={v.key} className="grid grid-cols-2 gap-2 rounded-lg border border-gray-100 p-2 sm:grid-cols-[minmax(0,1fr)_10rem_7rem] sm:items-center sm:border-0 sm:p-0 sm:px-1">
                  <span className="col-span-2 truncate text-sm font-medium text-ink-dark sm:col-span-1" title={label}>
                    {label}
                  </span>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:sr-only">SKU</span>
                    <input
                      data-field={sf}
                      value={v.sku}
                      maxLength={64}
                      aria-label={`SKU for ${label}`}
                      placeholder="Automatic"
                      onChange={(e) => onPatchVariant(v.key, { sku: e.target.value })}
                      className={`${cellCls} ${fieldError(sf) ? 'border-red-400' : 'border-gray-300'}`}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 sm:sr-only">Weight (kg)</span>
                    <WeightInput
                      grams={v.weightGrams}
                      onChange={(g) => onPatchVariant(v.key, { weightGrams: g })}
                      label={`Weight in kg for ${label}`}
                      field={wf}
                      error={!!fieldError(wf)}
                    />
                  </label>
                  <div className="col-span-2 sm:col-span-3">
                    <FormError message={fieldError(sf) ?? fieldError(wf)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
