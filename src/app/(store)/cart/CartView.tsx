'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useCart, type CartItem } from '@/lib/cart';
import { formatRs } from '@/components/ui/Price';
import { CART_NOTE_KEY, variantLabel } from '@/components/checkout/format';

/** Product handle → option names in position order (e.g. `["Size"]`), for "Size: 1 Seater". */
export type OptionNames = Record<string, string[]>;

/** Live `.product-cart-item-options`: "Name: value" per option (Shopify `options_with_values`). */
function optionsLine(item: CartItem, optionNames: OptionNames): string {
  const label = variantLabel(item.variantTitle);
  if (!label) return '';
  const names = optionNames[item.handle] ?? [];
  const values = label.split(' / ');
  if (names.length !== values.length) return label;
  return values.map((v, i) => `${names[i]}: ${v}`).join(' / ');
}

/* Live theme glyphs (quantity-selector minus/plus, red cart trash). */
function MinusGlyph() {
  return (
    <svg width="8" height="2" viewBox="0 0 8 2" fill="currentColor" aria-hidden>
      <path d="M3.49692e-08 1.39998L0 0.599976L8 0.599976V1.39998L3.49692e-08 1.39998Z" />
    </svg>
  );
}

function PlusGlyph() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden>
      <path d="M3.6 0H4.4V8H3.6V0Z" />
      <path d="M3.49692e-08 4.4L0 3.6L8 3.6V4.4L3.49692e-08 4.4Z" />
    </svg>
  );
}

function RemoveGlyph() {
  return (
    <svg width="13" height="14" viewBox="0 0 13 14" fill="none" aria-hidden>
      <path
        d="M12 3L1 3M5.00024 6V10M8.00024 6V10M11.0002 3V12.5C11.0002 12.6326 10.9476 12.7598 10.8538 12.8536C10.76 12.9473 10.6329 13 10.5002 13H2.50024C2.36764 13 2.24046 12.9473 2.14669 12.8536C2.05292 12.7598 2.00024 12.6326 2.00024 12.5V3M9.00025 3V2C9.00025 1.73478 8.89489 1.48043 8.70735 1.29289C8.51982 1.10536 8.26546 1 8.00024 1H5.00024C4.73503 1 4.48067 1.10536 4.29314 1.29289C4.1056 1.48043 4.00024 1.73478 4.00024 2V3"
        stroke="#E93636"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Live `<quantity-selector>`: square 1px box, absolutely placed −/+ buttons, typed input clamped 1–99. */
function Quantity({ item, small = false }: { item: CartItem; small?: boolean }) {
  const { setQty } = useCart();
  const [draft, setDraft] = useState(String(item.qty));
  useEffect(() => setDraft(String(item.qty)), [item.qty]);

  const commit = () => {
    const n = parseInt(draft, 10);
    if (Number.isNaN(n)) return setDraft(String(item.qty));
    setQty(item.key, Math.min(99, Math.max(1, n)));
  };

  const box = small ? 'h-[30px] px-[25px]' : 'h-[52px] px-[30px]';
  const btn = small ? 'w-[25px]' : 'w-[30px]';
  return (
    <div className={`relative inline-flex items-center rounded-btn border border-formline ${box}`}>
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => setQty(item.key, Math.max(1, item.qty - 1))}
        className={`absolute left-0 top-0 flex h-full items-center justify-center text-accent ${btn}`}
      >
        <MinusGlyph />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={99}
        aria-label={`Quantity for ${item.title}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), commit())}
        className={`w-[25px] appearance-none border-0 bg-transparent p-0 text-center text-[13px] font-semibold text-accent outline-none [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          small ? 'h-[28px]' : 'h-[50px]'
        }`}
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => setQty(item.key, Math.min(99, item.qty + 1))}
        className={`absolute right-0 top-0 flex h-full items-center justify-center text-accent ${btn}`}
      >
        <PlusGlyph />
      </button>
    </div>
  );
}

function RemoveLink({ item }: { item: CartItem }) {
  const { removeItem } = useCart();
  return (
    <a
      href="/cart"
      role="button"
      aria-label={`Remove ${item.title}`}
      title="Remove"
      onClick={(e) => {
        e.preventDefault();
        removeItem(item.key);
      }}
      className="ml-[15px] inline-flex -translate-y-[3px] align-middle"
    >
      <RemoveGlyph />
    </a>
  );
}

function CartRow({ item, optionNames }: { item: CartItem; optionNames: OptionNames }) {
  const options = optionsLine(item, optionNames);
  const href = `/products/${item.handle}`;
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="py-5 pl-0 pr-[15px] align-middle md:pr-[30px]">
        <div className="flex max-w-[400px] items-start md:items-center">
          <Link href={href} className="mr-[15px] block w-[75px] shrink-0 md:mr-[30px] md:w-[100px]">
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={item.title} className="block h-auto w-full" />
            ) : null}
          </Link>
          <div>
            <Link href={href} className="block text-[15px] font-normal leading-[1.4] text-accent transition-colors hover:text-accent2">
              {item.title}
            </Link>
            {options && <div className="mt-[5px] text-[12px] leading-[1.75] opacity-80">{options}</div>}
            <div className="mt-2 md:hidden">
              <Quantity item={item} small /> <RemoveLink item={item} />
            </div>
          </div>
        </div>
      </td>
      <td className="hidden py-5 pl-0 pr-[30px] align-middle md:table-cell">
        {/* inline like live (selector, space, link): the space counts toward the column width */}
        <Quantity item={item} /> <RemoveLink item={item} />
      </td>
      <td className="px-0 py-5 text-right align-middle">
        {/* live `.price` is a block; below 768 it gets 0 0 .2em .4em padding at line-height .9 (narrows the TOTAL column) */}
        <span className="price block whitespace-nowrap max-md:pb-[2.8px] max-md:pl-[5.6px] max-md:leading-[0.9]">
          {formatRs(item.price * item.qty)}
        </span>
      </td>
    </tr>
  );
}

function CartNote() {
  const [note, setNote] = useState('');
  useEffect(() => {
    try {
      setNote(localStorage.getItem(CART_NOTE_KEY) ?? '');
    } catch {
      // storage unavailable
    }
  }, []);
  // Live: the textarea is inline-block, so the 17px/1.75 line strut leaves ~10px below it (no margin).
  return (
    <div>
      <label
        htmlFor="cart-note"
        className="block py-[18px] text-[12px] font-semibold uppercase leading-none tracking-btn text-accent"
      >
        Add Notes
      </label>
      <textarea
        id="cart-note"
        name="note"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          try {
            localStorage.setItem(CART_NOTE_KEY, e.target.value);
          } catch {
            // storage unavailable
          }
        }}
        className="inline-block min-h-[120px] w-full resize-y rounded-btn border border-formline bg-transparent px-[22px] py-[17px] text-[13px] leading-[1.15] text-accent outline-none transition-colors duration-[250ms] ease-theme focus:border-accent"
      />
    </div>
  );
}

export function CartView({ optionNames }: { optionNames: OptionNames }) {
  const { items, subtotal, hydrated } = useCart();

  // Before hydration the cart is unknown: hold the space without flashing either state.
  if (!hydrated) return <div className="min-h-[60vh]" aria-busy />;

  if (items.length === 0) {
    return (
      <div className="py-10 md:py-[70px]">
        <div className="container-iw">
          <div className="mx-auto max-w-[570px] py-10 text-center md:py-[70px] lg:py-[100px]">
            <h1 className="mb-5 text-[46px] font-semibold leading-[54px] md:text-[54px] md:leading-[62px] lg:text-[64px] lg:leading-[72px]">Your cart is empty</h1>
            <p className="mb-5 leading-[1.7]">Ready to find your new favorite products?</p>
            <Link href="/" className="btn-accent2 mt-5 border-0">
              <span>Continue shopping</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-10 md:py-[70px]">
      <div className="container-iw lg:grid lg:grid-cols-[calc((100%_+_30px)*2/3_-_30px)_minmax(0,1fr)] lg:gap-x-[30px]">
        <div>
          <h4 className="mb-[30px] text-[28px] font-semibold leading-[36px] md:text-[30px] md:leading-[38px]">Your cart</h4>
          <table className="mb-[30px] w-full border-collapse text-[15px]">
            <thead>
              <tr className="border-b border-line">
                {['Product', 'Quantity', 'Total'].map((label, i) => (
                  <th
                    key={label}
                    scope="col"
                    className={`px-0 py-[18px] text-[11px] font-normal uppercase leading-none tracking-title ${
                      i === 2 ? 'text-right' : 'text-left'
                    } ${i === 1 ? 'hidden md:table-cell' : ''}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items
                .slice()
                .reverse()
                .map((item) => (
                  <CartRow key={item.key} item={item} optionNames={optionNames} />
                ))}
            </tbody>
          </table>
          <Link href="/collections/all" className="text-button mr-[15px] inline leading-[1.75] hover:text-accent2">
            Continue shopping
          </Link>
        </div>

        <div className="mt-10 lg:mt-0 lg:pl-10">
          <h4 className="mb-[30px] text-[28px] font-semibold leading-[36px] md:text-[30px] md:leading-[38px]">Order Summary</h4>
          <CartNote />
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <th scope="row" className="border-b border-line py-5 pl-0 pr-[15px] text-left text-[17px] font-normal md:pr-[30px]">
                  Subtotal
                </th>
                <td className="px-0 py-5 text-right text-[17px] font-normal">
                  <span className="font-medium tracking-soft">{formatRs(subtotal)}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <Link href="/checkout" className="btn btn-full border-0">
            <span>Checkout</span>
          </Link>
          <p className="mt-5 text-[13px] leading-[1.7] opacity-60">
            Taxes and{' '}
            <Link href="/pages/shipping-and-delivery" className="underline underline-offset-2">
              shipping
            </Link>{' '}
            calculated at checkout
          </p>
        </div>
      </div>
    </div>
  );
}
