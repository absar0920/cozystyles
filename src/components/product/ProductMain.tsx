'use client';

import { useCallback, useMemo, useState } from 'react';
import { useCart } from '@/lib/cart';
import { formatRs } from '@/components/ui/Price';
import { ProductGallery, type GalleryImage } from './ProductGallery';
import { VariantPicker, type OptionGroup } from './VariantPicker';
import { PreOrderModal } from './PreOrderModal';
import { MinusIcon, PlusIcon } from './icons';
import { optionAt, unavailableValues, type ProductOption, type VariantInfo } from './types';

export type ProductMainData = {
  id: number;
  handle: string;
  title: string;
  images: GalleryImage[];
  options: ProductOption[];
  variants: VariantInfo[];
  /** value → hex for colour options */
  swatches: Record<string, string>;
  /** SKU → gallery index of the variant image */
  variantImages: Record<string, number>;
  initialVariantId: number | null;
  isNew: boolean;
  /** Tag "Delivered in …" (also triggers the red FREE DELIVERY! tag like live). */
  deliveryLine: string | null;
  /** SKUs sold as pre-order (live ReStock selling plan). */
  preOrderSkus: string[];
};

const COLOR_OPTION = /colou?r/i;

/**
 * Main product section (live `.thb-product-detail`): gallery (7/12, sticky) + information (5/12):
 * title, SKU, price + badges, FREE DELIVERY tag, variant pickers, qty + ADD TO CART / PRE-ORDER,
 * delivery status, then the server-rendered description and share row (`children`).
 */
export function ProductMain({ product, children }: { product: ProductMainData; children?: React.ReactNode }) {
  const { addItem } = useCart();

  const groups = useMemo<OptionGroup[]>(() => {
    const out: OptionGroup[] = [];
    product.options.forEach((opt, index) => {
      const values = opt.values.filter((v) => product.variants.some((variant) => optionAt(variant, index) === v));
      if (values.length === 0 || (values.length === 1 && values[0] === 'Default Title')) return;
      const swatches = COLOR_OPTION.test(opt.name)
        ? Object.fromEntries(values.map((v) => [v, product.swatches[v] ?? '#ccc']))
        : undefined;
      out.push({ index, name: opt.name, values, swatches });
    });
    return out;
  }, [product]);

  const [variantId, setVariantId] = useState<number | null>(
    product.initialVariantId ?? product.variants.find((v) => v.inventory > 0)?.id ?? product.variants[0]?.id ?? null,
  );
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0] ?? null;

  // Gallery order: the selected variant's image moves first, and is re-led on every variant change
  // (live Habitat re-renders the media list with the variant media first and selects it).
  const [lead, setLead] = useState<number | undefined>(() =>
    variant?.sku != null ? product.variantImages[variant.sku] : undefined,
  );
  const order = useMemo(() => {
    const idx = product.images.map((_, i) => i);
    if (lead != null && lead > 0 && lead < idx.length) {
      idx.splice(lead, 1);
      idx.unshift(lead);
    }
    return idx;
  }, [product.images, lead]);
  const galleryImages = useMemo(() => order.map((i) => product.images[i]), [order, product.images]);
  const [slide, setSlide] = useState(0);

  const [qty, setQty] = useState(1);
  const [preOrderOpen, setPreOrderOpen] = useState(false);

  const selected = useMemo(() => {
    const out: Record<number, string> = {};
    groups.forEach((g) => {
      out[g.index] = variant ? optionAt(variant, g.index) : '';
    });
    return out;
  }, [groups, variant]);

  const unavailable = useMemo(
    () =>
      unavailableValues(
        product.variants,
        groups.map((g) => ({ index: g.index, value: selected[g.index] ?? '' })),
        (variant?.inventory ?? 0) > 0,
      ),
    [product.variants, groups, selected, variant],
  );

  const onSelect = useCallback(
    (index: number, value: string) => {
      const want = { ...selected, [index]: value };
      const next =
        product.variants.find((v) => groups.every((g) => optionAt(v, g.index) === want[g.index])) ??
        product.variants.find((v) => optionAt(v, index) === value);
      if (!next) return;
      setVariantId(next.id);
      const img = next.sku != null ? product.variantImages[next.sku] : undefined;
      if (img != null && img < product.images.length) {
        setLead(img);
        setSlide(0);
      }
      const url = new URL(window.location.href);
      url.searchParams.set('variant', String(next.id));
      window.history.replaceState(window.history.state, '', url);
    },
    [selected, product.variants, product.variantImages, product.images.length, groups],
  );

  const inStock = (variant?.inventory ?? 0) > 0;
  const preOrder = inStock && variant?.sku != null && product.preOrderSkus.includes(variant.sku);
  const soldOut = !inStock;
  const onSale = variant != null && variant.compareAtPrice != null && variant.compareAtPrice > variant.price;
  const pct = onSale && variant ? Math.round((((variant.compareAtPrice as number) - variant.price) / (variant.compareAtPrice as number)) * 100) : 0;
  const variantImage =
    (variant?.sku != null && product.images[product.variantImages[variant.sku] ?? -1]?.src) || product.images[0]?.src || '';

  const addToCart = () => {
    if (!variant || soldOut) return;
    addItem(
      {
        productId: product.id,
        variantId: variant.id,
        handle: product.handle,
        title: product.title,
        variantTitle: variant.title && variant.title !== 'Default Title' ? variant.title : '',
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        image: variantImage,
      },
      qty,
    );
  };

  return (
    <div className="mx-auto flow-root max-w-[1360px] lg:mt-10 lg:flex lg:items-start">
      {/* gallery column */}
      <div className="lg:sticky lg:top-[100px] lg:w-7/12 lg:pl-10 lg:pr-[19px]">
        <ProductGallery images={galleryImages} index={slide} onIndex={setSlide} />
      </div>

      {/* information column */}
      <div className="px-[12.5px] pt-10 md:px-10 lg:w-5/12 lg:pl-[11px] lg:pr-10 lg:pt-0">
        <div className="max-w-[600px]">
          <div className="mb-5 border-b border-line pb-5">
            {product.isNew && (
              // inline in a 17px/29.75px line box like live, so the label sits on the body-text baseline
              <div className="text-[17px] leading-[29.75px]">
                <span className="text-[8.5px] font-medium leading-[8.5px] text-[#ff0000]">NEW</span>
              </div>
            )}
            <h1 className="mb-[5px] text-[30px] font-normal leading-[38px] text-accent">{product.title}</h1>
            {variant?.sku && <div className="text-[17px] leading-[29.75px]">SKU:{variant.sku}</div>}
            {variant && variant.price > 0 && (
              <div className="ml-2 flex flex-wrap items-center pb-1 text-[20px] leading-[18px] tracking-[0.4px] lg:ml-0 lg:pb-0 lg:leading-[35px]">
                <ins className="font-medium no-underline">{formatRs(variant.price)}</ins>
                {onSale && (
                  <del className="ml-[5px] text-[18px] font-semibold opacity-40">{formatRs(variant.compareAtPrice as number)}</del>
                )}
                {(pct > 0 || soldOut) && (
                  <span className="ml-[10px] flex items-center gap-[10px] lg:ml-[18px]">
                    {pct > 0 && <Badge className="bg-accent2">{pct}% off</Badge>}
                    {soldOut && <Badge className="bg-soldout">Sold out</Badge>}
                  </span>
                )}
              </div>
            )}
            {product.deliveryLine && (
              <span className="mt-[5px] block w-fit bg-[#ff0000] px-[10px] text-[11px] font-bold uppercase leading-[19.25px] text-white md:text-[15px] md:leading-[26.25px]">
                Free Delivery!
              </span>
            )}
          </div>

          <VariantPicker groups={groups} selected={selected} unavailable={unavailable} onSelect={onSelect} />

          {variant && (
            <div className="mt-[30px]">
              <div className="flex h-[52px] items-stretch">
                <div className="qty mr-[10px] w-[87px] shrink-0">
                  <button type="button" aria-label="Decrease quantity" className="!w-[30px]" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    <MinusIcon className="h-[2px] w-2" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={qty}
                    aria-label="Quantity"
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setQty(Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1);
                    }}
                  />
                  <button type="button" aria-label="Increase quantity" className="!w-[30px]" onClick={() => setQty((q) => Math.min(99, q + 1))}>
                    <PlusIcon className="h-2 w-2" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={addToCart}
                  disabled={soldOut}
                  className={
                    soldOut
                      ? // live `.button.sold-out`: transparent with a 1px #eee edge, a 3% black ::before wash, text at 50%
                        'flex h-[52px] flex-1 cursor-not-allowed items-center justify-center rounded-btn border border-line bg-black/[0.03] px-[27px] text-[13px] font-bold uppercase leading-[13px] tracking-[2.6px] text-accent'
                      : 'btn h-[52px] flex-1'
                  }
                >
                  <span className={soldOut ? 'opacity-50' : undefined}>{soldOut ? 'Sold out' : preOrder ? 'Pre-order' : 'Add to cart'}</span>
                </button>
              </div>

              {preOrder ? (
                <>
                  <button
                    type="button"
                    onClick={() => setPreOrderOpen(true)}
                    className="mb-[13px] mt-[25px] inline-flex h-[52px] w-full items-center justify-center rounded-[4px] border-2 border-accent bg-white p-[11.7px] text-[13px] font-bold uppercase leading-[13px] tracking-[2.6px] text-accent"
                  >
                    What is Pre-Order?
                  </button>
                  <p className="mb-[10px] text-[13px] font-medium leading-[22.75px] text-black">
                    Our team will contact you to let you know about the delivery date of this product.
                  </p>
                </>
              ) : (
                // live empties the delivery-status block for a sold-out variant; the empty block's
                // collapsed margins still leave 25px above the description
                <div className="mb-[10px] mt-[25px] text-[13px] leading-[22.75px] text-black">
                  {/* live asks for weight 300 but only loads Poppins 400–700, so it renders at 400 */}
                  {!soldOut && product.deliveryLine && <p className="leading-[22.1px]">{product.deliveryLine}</p>}
                  {!soldOut && <p>Our team will get in touch with you to communicate the exact delivery time.</p>}
                </div>
              )}
            </div>
          )}

          {children}
        </div>
      </div>

      {preOrderOpen && <PreOrderModal onClose={() => setPreOrderOpen(false)} />}
    </div>
  );
}

/** Live badge: <768 it computes to weight 100, which renders as Poppins 400 (no lighter face loaded). */
function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`flex h-[22px] items-center rounded-btn px-[7px] text-[8px] font-normal uppercase leading-none tracking-[0.4px] text-white md:text-[10px] md:tracking-[0.5px] md:font-bold ${className}`}
    >
      {children}
    </span>
  );
}
