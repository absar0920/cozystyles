'use client';

import { useCallback, useMemo, useState } from 'react';
import { formatRs } from '@/components/ui/Price';
import { OrderOnWhatsAppButton } from '@/components/whatsapp/OrderOnWhatsApp';
import { NEUTRAL_SWATCH, isSwatchOptionName } from '@/lib/product-options';
import { isAvailable } from '@/lib/variant-status';
import type { WhatsAppConfig } from '@/lib/whatsapp';
import { ProductGallery } from './ProductGallery';
import { VariantPicker, type OptionGroup } from './VariantPicker';
import { PreOrderModal } from './PreOrderModal';
import { MinusIcon, PlusIcon } from './icons';
import { optionAt, unavailableValues, type ProductImageInfo, type ProductOption, type SwatchMap, type VariantInfo } from './types';

export type ProductMainData = {
  id: number;
  handle: string;
  title: string;
  /** in gallery order, each with its "Shows" tag */
  images: ProductImageInfo[];
  options: ProductOption[];
  variants: VariantInfo[];
  /** option position → value → swatch (colour / finish options only) */
  swatches: SwatchMap;
  initialVariantId: number | null;
  isNew: boolean;
  /** "Delivered in …" (also triggers the red FREE DELIVERY! tag like live). */
  deliveryLine: string | null;
};

const GENERIC_OPTION_NAME = /^option \d+$/i;

/**
 * Main product section (live `.thb-product-detail`): gallery (7/12, sticky) + information (5/12):
 * title, SKU, price + badges, FREE DELIVERY tag, variant pickers, qty + ORDER ON WHATSAPP / ASK ABOUT
 * AVAILABILITY, delivery status, then the server-rendered description and share row (`children`).
 * Availability comes from each variant's status; the gallery leads with the photo tagged with the
 * selected option value ("Shows").
 */
export function ProductMain({
  product,
  whatsapp,
  children,
}: {
  product: ProductMainData;
  whatsapp: WhatsAppConfig | null;
  children?: React.ReactNode;
}) {
  const groups = useMemo<OptionGroup[]>(() => {
    const out: OptionGroup[] = [];
    product.options.forEach((opt, index) => {
      const values = opt.values.filter((v) => product.variants.some((variant) => optionAt(variant, index) === v));
      // a single value is not a choice (Shopify hides those pickers too)
      if (values.length <= 1) return;
      const sw = product.swatches[index];
      const swatches = sw ? Object.fromEntries(values.map((v) => [v, sw[v] ?? { color: NEUTRAL_SWATCH, image: null }])) : undefined;
      out.push({ index, name: opt.name, values, swatches });
    });
    return out;
  }, [product]);

  const tagged = useCallback(
    (optionIndex: number, value: string) => product.images.findIndex((im) => im.tag?.optionIndex === optionIndex && im.tag.value === value),
    [product.images],
  );
  /** Option positions, colour/finish options first: the order lead photos are looked up in. */
  const lookupOrder = useMemo(() => {
    const idx = product.options.map((_, i) => i);
    return [...idx.filter((i) => isSwatchOptionName(product.options[i].name)), ...idx.filter((i) => !isSwatchOptionName(product.options[i].name))];
  }, [product.options]);

  const [variantId, setVariantId] = useState<number | null>(
    product.initialVariantId ?? product.variants.find((v) => isAvailable(v.status))?.id ?? product.variants[0]?.id ?? null,
  );
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0] ?? null;

  // Gallery order: the lead photo (tagged with a selected value) moves first, like live Habitat
  // re-rendering the media list with the variant media first.
  const [lead, setLead] = useState<number | undefined>(() => {
    if (!variant) return undefined;
    for (const i of lookupOrder) {
      const at = tagged(i, optionAt(variant, i));
      if (at >= 0) return at;
    }
    return undefined;
  });
  const order = useMemo(() => {
    const idx = product.images.map((_, i) => i);
    if (lead != null && lead > 0 && lead < idx.length) {
      idx.splice(lead, 1);
      idx.unshift(lead);
    }
    return idx;
  }, [product.images, lead]);
  const galleryImages = useMemo(() => order.map((i) => ({ src: product.images[i].src, alt: product.images[i].alt })), [order, product.images]);
  const [slide, setSlide] = useState(0);

  const [qty, setQty] = useState(1);
  /** what the customer is typing in the quantity box (null = show `qty`) */
  const [qtyDraft, setQtyDraft] = useState<string | null>(null);
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
        variant ? isAvailable(variant.status) : false,
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
      let img = tagged(index, value);
      if (img < 0) {
        // no photo for the clicked value: keep the current lead, unless a selected colour/finish has one
        for (const i of lookupOrder) {
          if (i === index || !isSwatchOptionName(product.options[i].name)) continue;
          const at = tagged(i, optionAt(next, i));
          if (at >= 0) {
            img = at;
            break;
          }
        }
      }
      if (img >= 0 && img !== lead) {
        setLead(img);
        setSlide(0);
      }
      const url = new URL(window.location.href);
      url.searchParams.set('variant', String(next.id));
      window.history.replaceState(window.history.state, '', url);
    },
    [selected, product.variants, product.options, groups, tagged, lookupOrder, lead],
  );

  const status = variant?.status ?? 'SOLD_OUT';
  const soldOut = status === 'SOLD_OUT';
  const preOrder = status === 'PRE_ORDER';
  const madeToOrder = status === 'MADE_TO_ORDER';
  const onSale = variant != null && variant.compareAtPrice != null && variant.compareAtPrice > variant.price;
  const pct = onSale && variant ? Math.round((((variant.compareAtPrice as number) - variant.price) / (variant.compareAtPrice as number)) * 100) : 0;

  // the message lists every chosen option (single-value options too, unless they only have a placeholder name)
  const messageOptions = variant
    ? product.options
        .map((o, i) => ({ name: o.name, value: optionAt(variant, i), shown: groups.some((g) => g.index === i) }))
        .filter((o) => o.value && (o.shown || !GENERIC_OPTION_NAME.test(o.name)))
        .map(({ name, value }) => ({ name, value }))
    : [];

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
            {variant && (
              <div className="ml-2 flex flex-wrap items-center pb-1 text-[20px] leading-[18px] tracking-[0.4px] lg:ml-0 lg:pb-0 lg:leading-[35px]">
                {/* a Regular price of 0 means "Price on request" (spec §5.1.4); its status badges still show */}
                {variant.price > 0 ? (
                  <ins className="font-medium no-underline">{formatRs(variant.price)}</ins>
                ) : (
                  <span className="font-medium" data-testid="price-on-request">Price on request</span>
                )}
                {variant.price > 0 && onSale && (
                  <del className="ml-[5px] text-[18px] font-semibold opacity-40">{formatRs(variant.compareAtPrice as number)}</del>
                )}
                {(pct > 0 || soldOut || preOrder) && (
                  <span className="ml-[10px] flex items-center gap-[10px] lg:ml-[18px]">
                    {pct > 0 && <Badge className="bg-accent2">{pct}% off</Badge>}
                    {soldOut && <Badge className="bg-soldout">Sold out</Badge>}
                    {preOrder && <Badge className="bg-accent2">Pre-order</Badge>}
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
              {whatsapp && (
                <div className="flex h-[52px] items-stretch">
                  <div className="qty mr-[10px] w-[87px] shrink-0">
                    <button type="button" aria-label="Decrease quantity" className="!w-[30px]" onClick={() => {
                      setQtyDraft(null);
                      setQty((q) => Math.max(1, q - 1));
                    }}>
                      <MinusIcon className="h-[2px] w-2" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={qtyDraft ?? qty}
                      aria-label="Quantity"
                      onChange={(e) => {
                        // keep what is typed (an emptied box stays empty); the order uses the last valid number
                        const raw = e.target.value;
                        setQtyDraft(raw);
                        const n = parseInt(raw, 10);
                        if (Number.isFinite(n) && n >= 1) setQty(Math.min(99, n));
                      }}
                      onBlur={() => setQtyDraft(null)}
                    />
                    <button type="button" aria-label="Increase quantity" className="!w-[30px]" onClick={() => {
                      setQtyDraft(null);
                      setQty((q) => Math.min(99, q + 1));
                    }}>
                      <PlusIcon className="h-2 w-2" />
                    </button>
                  </div>
                  <OrderOnWhatsAppButton
                    config={whatsapp}
                    product={{ id: product.id, title: product.title, handle: product.handle }}
                    variant={{ id: variant.id, price: variant.price, compareAtPrice: variant.compareAtPrice, status: variant.status }}
                    options={messageOptions}
                    quantity={qty}
                  />
                </div>
              )}

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
                  {!soldOut && !madeToOrder && <p>Our team will get in touch with you to communicate the exact delivery time.</p>}
                  {madeToOrder && <p>Made to Order — our team will confirm the delivery time with you.</p>}
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
