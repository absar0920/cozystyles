'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { formatPKR } from '@/lib/money';
import { CartIcon, MinusIcon, PlusIcon, TrashIcon, ShieldIcon, TruckIcon } from '@/components/icons';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { OrderSummary } from '@/components/checkout/OrderSummary';

function QtyStepper({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  return (
    <div className="inline-flex items-center rounded-full border border-cream-border bg-white shadow-sm">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-dark transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:text-ink-light disabled:hover:bg-transparent disabled:hover:text-ink-light"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span className="flex w-10 items-center justify-center text-sm font-semibold text-ink-dark">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(99, value + 1))}
        disabled={value >= 99}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-dark transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:text-ink-light disabled:hover:bg-transparent disabled:hover:text-ink-light"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-3" aria-hidden>
      <div className="space-y-4 lg:col-span-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex animate-pulse gap-4 rounded-2xl bg-cream-soft p-4">
            <div className="h-24 w-24 shrink-0 rounded-lg bg-cream" />
            <div className="flex-1 space-y-3 py-1">
              <div className="h-4 w-2/3 rounded bg-cream" />
              <div className="h-3 w-1/3 rounded bg-cream" />
              <div className="h-8 w-28 rounded-full bg-cream" />
            </div>
          </div>
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl bg-cream-soft" />
    </div>
  );
}

export default function CartPage() {
  const { items, count, subtotal, savings, hydrated, setQty, removeItem } = useCart();

  return (
    <div className="bg-white py-8 sm:py-12">
      <div className="container-iw">
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Cart' }]} className="mb-4" />

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Shopping Bag</p>
            <h1 className="mt-1 font-heading text-2xl font-bold text-ink-dark sm:text-3xl">Your Cart</h1>
          </div>
          {hydrated && items.length > 0 && (
            <p className="pb-0.5 text-sm text-ink-muted">
              {count} {count === 1 ? 'item' : 'items'} in your cart
            </p>
          )}
        </div>

        {!hydrated ? (
          <CartSkeleton />
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl bg-white px-6 py-14 text-center shadow-card">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand">
              <CartIcon className="h-9 w-9" />
            </span>
            <h2 className="mt-5 font-heading text-xl font-semibold text-ink-dark">Your cart is empty</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Browse Pakistan&rsquo;s largest furniture range and add something you love to your cart.
            </p>
            <Link href="/collections/all" className="btn-primary mt-6">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-3 lg:gap-8">
            <div className="space-y-4 lg:col-span-2">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex gap-4 rounded-2xl bg-cream-soft p-4 transition sm:p-5"
                >
                  <Link
                    href={`/products/${item.handle}`}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-white sm:h-28 sm:w-28"
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image}
                        alt={item.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-sm font-semibold text-ink-light">
                        IW
                      </span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/products/${item.handle}`}
                          className="line-clamp-2 text-sm font-semibold leading-snug text-ink-dark transition hover:text-brand"
                        >
                          {item.title}
                        </Link>
                        {item.variantTitle && item.variantTitle !== 'Default Title' && (
                          <p className="mt-0.5 truncate text-xs text-ink-muted">{item.variantTitle}</p>
                        )}
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-sm font-bold text-brand">{formatPKR(item.price)}</span>
                          {item.compareAtPrice != null && item.compareAtPrice > item.price && (
                            <span className="text-xs text-ink-light line-through">{formatPKR(item.compareAtPrice)}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label={`Remove ${item.title} from cart`}
                        className="shrink-0 rounded-full p-2 text-ink-muted transition hover:bg-sale/10 hover:text-sale"
                      >
                        <TrashIcon className="h-4.5 w-4.5" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 sm:mt-auto">
                      <QtyStepper value={item.qty} onChange={(next) => setQty(item.key, next)} />
                      <div className="text-right">
                        <span className="block text-[11px] uppercase tracking-wide text-ink-muted">Line total</span>
                        <span className="font-heading text-base font-bold text-ink-dark">
                          {formatPKR(item.price * item.qty)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Link
                href="/collections/all"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition hover:text-brand-700"
              >
                <PlusIcon className="h-4 w-4" />
                Continue Shopping
              </Link>
            </div>

            <div className="lg:sticky lg:top-24">
              <OrderSummary subtotal={subtotal} savings={savings} showItems={false}>
                <Link
                  href="/checkout"
                  className="btn-primary mt-5 w-full !px-4 text-base"
                  aria-label="Proceed to checkout"
                >
                  Checkout
                </Link>
                <div className="mt-4 space-y-2 border-t border-cream-border pt-4 text-xs text-ink-muted">
                  <p className="flex items-center gap-2">
                    <TruckIcon className="h-4 w-4 shrink-0 text-brand" />
                    Free Delivery &amp; Installation nationwide
                  </p>
                  <p className="flex items-center gap-2">
                    <ShieldIcon className="h-4 w-4 shrink-0 text-brand" />
                    1-Year Manufacturing Warranty
                  </p>
                </div>
              </OrderSummary>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
