'use client';

import { useState } from 'react';
import { formatCheckoutPrice, variantLabel } from '@/components/checkout/format';
import { FloatingInput, QuestionIcon } from '@/components/checkout/fields';

export type SummaryItem = {
  key?: string;
  title: string;
  variantTitle?: string;
  image?: string;
  price: number;
  qty: number;
};

/**
 * 64px product thumbnail with the black quantity badge (Shopify checkout line item): a #ededed
 * rounded tile with a soft shadow; the image itself has the 2px white border and is letterboxed.
 */
export function Thumb({
  image,
  title,
  qty,
  size = 64,
  className = '',
}: {
  image?: string;
  title: string;
  qty?: number;
  size?: number;
  className?: string;
}) {
  const radius = size < 64 ? 10 : 16;
  return (
    <span className={`relative block shrink-0 p-px ${className}`}>
      <span
        className="block bg-[#ededed] shadow-[0_0_0_.5px_rgba(0,0,0,.05),0_1px_3px_rgba(0,0,0,.04),0_2px_8px_rgba(0,0,0,.06)]"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="block h-full w-full border-2 border-white object-contain"
            style={{ borderRadius: radius }}
          />
        ) : null}
      </span>
      {qty != null && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-lg bg-black px-1 text-[12px] font-semibold leading-none text-white">
          {qty}
        </span>
      )}
    </span>
  );
}

/**
 * Mobile total-row thumbnail (live): the summary's last line as a 40px tile, and with more than one
 * line a blank #f5f5f5 card behind it, rotated 8deg and nudged right.
 */
export function StackedThumbs({ items }: { items: SummaryItem[] }) {
  const front = items[items.length - 1];
  if (!front) return null;
  const tile =
    'relative block h-10 w-10 rounded-xl bg-[#f5f5f5] shadow-[0_0_0_.5px_rgba(0,0,0,.05),0_1px_3px_rgba(0,0,0,.04),0_2px_8px_rgba(0,0,0,.06)]';
  return (
    <span className={`relative grid shrink-0 ${items.length > 1 ? 'pr-[7.69px]' : ''}`}>
      {items.length > 1 && (
        <span className="col-start-1 row-start-1 block translate-x-[7.69px] rotate-[8deg] p-px">
          <span className={tile} />
        </span>
      )}
      <span className="relative col-start-1 row-start-1 block p-px">
        <span className={tile}>
          {front.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={front.image} alt={front.title} loading="lazy" className="block h-full w-full rounded-xl border border-white object-contain" />
          ) : null}
        </span>
      </span>
    </span>
  );
}

function DiscountField() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  return (
    <form
      className="mt-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim()) setError('Enter a valid discount code or gift card');
      }}
    >
      <FloatingInput
        id="checkout-discount"
        label="Discount code or gift card"
        value={code}
        onValueChange={(v) => {
          setCode(v);
          setError('');
        }}
        error={error}
        autoComplete="off"
        className="[&_input]:pr-[76px]"
        trailing={
          <button
            type="submit"
            disabled={!code.trim()}
            className="h-[35px] rounded-xl bg-[#f5f5f5] px-[10px] text-[14px] font-semibold text-black shadow-[inset_0_0_0_1px_#dedede] disabled:text-[#707070]"
          >
            Apply
          </button>
        }
      />
    </form>
  );
}

/**
 * Shopify checkout order summary: line items, optional discount field and the
 * Subtotal · N items / Shipping / Total (PKR) block. All text black, system font.
 */
export function OrderSummary({
  items,
  subtotal,
  total = subtotal,
  shipping = 'Free',
  shippingPending = false,
  showDiscount = true,
}: {
  items: SummaryItem[];
  subtotal: number;
  total?: number;
  /** Right-hand text of the Shipping row. */
  shipping?: string;
  /** Shipping not calculated yet ("Enter shipping address"): grey text. */
  shippingPending?: boolean;
  showDiscount?: boolean;
}) {
  const count = items.reduce((s, i) => s + i.qty, 0);
  return (
    <div className="text-[14px] leading-[1.35] text-black">
      <h2 className="sr-only">Order summary</h2>
      <ul className="flex flex-col gap-[14px]">
        {items.map((item, idx) => {
          const v = variantLabel(item.variantTitle);
          return (
            <li key={item.key ?? idx} className="flex items-start gap-[14px]">
              <Thumb image={item.image} title={item.title} qty={item.qty} />
              <div className="min-w-0 flex-1 pt-[13px]">
                <p>{item.title}</p>
                {v && <p className="text-[12px] text-[#666]">{v}</p>}
              </div>
              <p className="shrink-0 pt-[13px] text-right">{formatCheckoutPrice(item.price * item.qty)}</p>
            </li>
          );
        })}
      </ul>

      {showDiscount && <DiscountField />}

      <dl className="mt-[34px] grid grid-cols-[1fr_auto] gap-y-[7px]">
        <dt>
          Subtotal · {count} {count === 1 ? 'item' : 'items'}
        </dt>
        <dd className="text-right">{formatCheckoutPrice(subtotal)}</dd>
        <dt className="flex items-center gap-1">
          Shipping
          <span title="Free delivery and installation nationwide" className="inline-flex text-[#707070]">
            <QuestionIcon className="h-3.5 w-3.5" />
          </span>
        </dt>
        <dd className={`text-right ${shippingPending ? 'text-[#666]' : ''}`}>{shipping}</dd>
        <dt className="mt-2 text-[18px] font-semibold leading-[1.35]">Total</dt>
        <dd className="mt-2 text-right">
          <span className="mr-[6px] align-[1px] text-[12px] text-[#666]">PKR</span>
          <strong className="text-[18px] font-semibold leading-[1.35]">{formatCheckoutPrice(total)}</strong>
        </dd>
      </dl>
    </div>
  );
}
