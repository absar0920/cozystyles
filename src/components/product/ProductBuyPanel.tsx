'use client';

import { useMemo, useState } from 'react';
import { formatPKR, discountPercent } from '@/lib/money';
import { VariantPicker } from './VariantPicker';
import type { OptionGroup } from './VariantPicker';
import { QuantityStepper } from './QuantityStepper';
import { AddToCartBar } from './AddToCartBar';
import type { ProductOption, VariantInfo } from './types';
import { optionAt } from './types';

export type BuyPanelProduct = {
  id: number;
  handle: string;
  title: string;
  image: string;
  options: ProductOption[];
  variants: VariantInfo[];
};

/**
 * Client orchestrator for the buy box: price, SKU, stock badge, variant
 * picker, quantity stepper and add-to-cart / buy-now actions.
 */
export function ProductBuyPanel({ product }: { product: BuyPanelProduct }) {
  const groups = useMemo<OptionGroup[]>(() => {
    const out: OptionGroup[] = [];
    product.options.forEach((opt, index) => {
      const values = opt.values.filter((v) => product.variants.some((variant) => optionAt(variant, index) === v));
      if (values.length > 0) out.push({ index, name: opt.name, values });
    });
    return out;
  }, [product]);

  const [selected, setSelected] = useState<Record<number, string>>(() => {
    const first = product.variants[0];
    const init: Record<number, string> = {};
    groups.forEach((g) => {
      init[g.index] = first ? optionAt(first, g.index) : '';
    });
    return init;
  });
  const [qty, setQty] = useState(1);

  const activeVariant = useMemo(() => {
    const { variants } = product;
    if (variants.length === 0) return null;
    if (groups.length === 0) return variants[0];
    return (
      variants.find((v) => groups.every((g) => optionAt(v, g.index) === (selected[g.index] ?? ''))) ??
      variants.find((v) => optionAt(v, groups[0].index) === (selected[groups[0].index] ?? '')) ??
      variants[0]
    );
  }, [product, groups, selected]);

  const off = activeVariant ? discountPercent(activeVariant.price, activeVariant.compareAtPrice) : null;
  const inStock = (activeVariant?.inventory ?? 0) > 0;
  const lowStock = inStock && (activeVariant?.inventory ?? 0) <= 5;

  return (
    <div className="flex flex-col gap-5">
      {/* Price */}
      {activeVariant && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span key={activeVariant.id} className="animate-fadeIn font-heading text-[28px] font-bold leading-none text-brand sm:text-3xl">
            {formatPKR(activeVariant.price)}
          </span>
          {activeVariant.compareAtPrice != null && activeVariant.compareAtPrice > activeVariant.price && (
            <span className="text-base font-medium text-ink-light line-through">{formatPKR(activeVariant.compareAtPrice)}</span>
          )}
          {off != null && (
            <span className="rounded-md bg-sale/10 px-2 py-0.5 text-xs font-bold text-sale">-{off}% OFF</span>
          )}
        </div>
      )}

      {/* SKU + stock */}
      {activeVariant && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {activeVariant.sku && (
            <span className="text-ink-muted">
              SKU: <span className="font-semibold text-ink-dark">{activeVariant.sku}</span>
            </span>
          )}
          {inStock ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              In Stock
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 font-semibold text-terra">
              <span className="h-1.5 w-1.5 rounded-full bg-terra" />
              Made to Order
            </span>
          )}
          {lowStock && <span className="font-semibold text-sale">Only {activeVariant.inventory} left</span>}
        </div>
      )}

      <VariantPicker
        groups={groups}
        variants={product.variants}
        selected={selected}
        onSelect={(index, value) => setSelected((prev) => ({ ...prev, [index]: value }))}
      />

      {activeVariant && (
        <>
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Quantity</span>
            <QuantityStepper value={qty} onChange={setQty} />
          </div>

          <AddToCartBar
            item={{
              productId: product.id,
              variantId: activeVariant.id,
              handle: product.handle,
              title: product.title,
              variantTitle: activeVariant.title && activeVariant.title !== 'Default Title' ? activeVariant.title : '',
              price: activeVariant.price,
              compareAtPrice: activeVariant.compareAtPrice,
              image: product.image,
            }}
            qty={qty}
          />
        </>
      )}
    </div>
  );
}
