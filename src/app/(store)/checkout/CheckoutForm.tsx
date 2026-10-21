'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { PAKISTAN_CITIES, PAKISTAN_PROVINCES } from '@/lib/constants';
import { CartIcon, ShieldIcon } from '@/components/icons';
import { OrderSummary } from '@/components/checkout/OrderSummary';
import { PaymentSelector } from '@/components/checkout/PaymentSelector';
import { validateCheckout, type CheckoutCustomer } from '@/components/checkout/validation';
import { formatPKR } from '@/lib/money';
import type { ShippingRule } from '@/lib/shipping';

type FieldErrors = Record<string, string>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-sale">{message}</p>;
}

export function CheckoutForm({ shipping }: { shipping: ShippingRule }) {
  const router = useRouter();
  const { items, subtotal, savings, hydrated, clear } = useCart();

  const [form, setForm] = useState<CheckoutCustomer>({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    province: 'Punjab',
    notes: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<string>('COD');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const set = (key: keyof CheckoutCustomer) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError('');

    const found = validateCheckout(form, paymentMethod, items.length);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Please correct the highlighted fields below.');
      return;
    }

    setSubmitting(true);
    (async () => {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer: form,
            paymentMethod,
            items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
          }),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; orderNumber?: string; error?: string } | null;
        if (res.ok && data?.ok && data.orderNumber) {
          clear();
          router.push(`/checkout/success?order=${encodeURIComponent(data.orderNumber)}`);
          return;
        }
        setFormError(data?.error ?? 'We could not place your order. Please try again.');
        setSubmitting(false);
      } catch {
        setFormError('Network error — please check your connection and try again.');
        setSubmitting(false);
      }
    })();
  }

  return (
    <div className="bg-cream-soft py-8 sm:py-12">
      <div className="container-iw">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-ink-muted">
          <Link href="/cart" className="transition hover:text-brand">
            Cart
          </Link>
          <span className="mx-1.5">/</span>
          <span className="font-medium text-ink-dark">Checkout</span>
        </nav>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold text-ink-dark sm:text-3xl">Checkout</h1>
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <ShieldIcon className="h-4 w-4 text-brand" />
            Secure checkout — your details stay private
          </p>
        </div>

        {!hydrated ? (
          <div className="grid animate-pulse gap-6 lg:grid-cols-5 lg:gap-8" aria-hidden>
            <div className="space-y-4 rounded-xl bg-cream p-6 lg:col-span-3">
              <div className="h-5 w-40 rounded bg-cream-border" />
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-11 rounded bg-cream-border/70" />
              ))}
            </div>
            <div className="h-96 rounded-xl bg-cream lg:col-span-2" />
          </div>
        ) : items.length === 0 ? (
          <div className="mx-auto max-w-md rounded-xl border border-cream-border bg-white px-6 py-14 text-center shadow-card">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-brand">
              <CartIcon className="h-9 w-9" />
            </span>
            <h2 className="mt-5 font-heading text-xl font-semibold text-ink-dark">Your cart is empty</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Add a few pieces to your cart before heading to checkout.
            </p>
            <Link href="/collections/all" className="btn-primary mt-6">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-5 lg:gap-8">
            {/* Left: customer + payment */}
            <div className="space-y-6 lg:col-span-3">
              <section className="rounded-xl border border-cream-border bg-white p-5 shadow-card sm:p-6">
                <h2 className="font-heading text-base font-semibold text-ink-dark">Delivery Details</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {shipping.freeThreshold > 0
                    ? `Free delivery & installation nationwide on orders over ${formatPKR(shipping.freeThreshold)}.`
                    : 'We deliver and install free of charge, nationwide.'}
                </p>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="co-name" className="label">
                      Full Name <span className="text-sale">*</span>
                    </label>
                    <input
                      id="co-name"
                      type="text"
                      value={form.name}
                      onChange={set('name')}
                      autoComplete="name"
                      placeholder="e.g. Ahmed Raza"
                      className={`input ${errors.name ? '!border-sale focus:!ring-sale/20' : ''}`}
                    />
                    <FieldError message={errors.name} />
                  </div>
                  <div>
                    <label htmlFor="co-phone" className="label">
                      Phone <span className="text-sale">*</span>
                    </label>
                    <input
                      id="co-phone"
                      type="tel"
                      value={form.phone}
                      onChange={set('phone')}
                      autoComplete="tel"
                      placeholder="03XX XXXXXXX"
                      className={`input ${errors.phone ? '!border-sale focus:!ring-sale/20' : ''}`}
                    />
                    <FieldError message={errors.phone} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="co-email" className="label">
                      Email <span className="font-normal normal-case text-ink-light">(optional)</span>
                    </label>
                    <input
                      id="co-email"
                      type="email"
                      value={form.email}
                      onChange={set('email')}
                      autoComplete="email"
                      placeholder="you@example.com"
                      className={`input ${errors.email ? '!border-sale focus:!ring-sale/20' : ''}`}
                    />
                    <FieldError message={errors.email} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="co-address" className="label">
                      Complete Address <span className="text-sale">*</span>
                    </label>
                    <textarea
                      id="co-address"
                      value={form.address}
                      onChange={set('address')}
                      rows={3}
                      autoComplete="street-address"
                      placeholder="House / flat no., street, area, landmark"
                      className={`input resize-none ${errors.address ? '!border-sale focus:!ring-sale/20' : ''}`}
                    />
                    <FieldError message={errors.address} />
                  </div>
                  <div>
                    <label htmlFor="co-city" className="label">
                      City <span className="text-sale">*</span>
                    </label>
                    <select
                      id="co-city"
                      value={form.city}
                      onChange={set('city')}
                      className={`input ${errors.city ? '!border-sale focus:!ring-sale/20' : ''} ${
                        form.city ? '' : 'text-ink-light'
                      }`}
                    >
                      <option value="" disabled>
                        Select city
                      </option>
                      {PAKISTAN_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.city} />
                  </div>
                  <div>
                    <label htmlFor="co-province" className="label">
                      Province <span className="text-sale">*</span>
                    </label>
                    <select
                      id="co-province"
                      value={form.province}
                      onChange={set('province')}
                      className={`input ${errors.province ? '!border-sale focus:!ring-sale/20' : ''}`}
                    >
                      {PAKISTAN_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <FieldError message={errors.province} />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="co-notes" className="label">
                      Order Notes <span className="font-normal normal-case text-ink-light">(optional)</span>
                    </label>
                    <textarea
                      id="co-notes"
                      value={form.notes}
                      onChange={set('notes')}
                      rows={2}
                      placeholder="Delivery preferences, colour choice, best time to call…"
                      className="input resize-none"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-cream-border bg-white p-5 shadow-card sm:p-6">
                <h2 className="font-heading text-base font-semibold text-ink-dark">Payment Method</h2>
                <div className="mt-4">
                  <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />
                </div>
                <FieldError message={errors.paymentMethod} />
              </section>
            </div>

            {/* Right: summary */}
            <div className="lg:sticky lg:top-24 lg:col-span-2">
              <OrderSummary
                items={items.map((i) => ({
                  key: i.key,
                  title: i.title,
                  variantTitle: i.variantTitle,
                  image: i.image,
                  price: i.price,
                  compareAtPrice: i.compareAtPrice,
                  qty: i.qty,
                }))}
                subtotal={subtotal}
                savings={savings}
                shipping={shipping}
              >
                {formError && (
                  <p role="alert" className="mt-4 rounded-md border border-sale/30 bg-sale/5 px-3 py-2.5 text-xs font-medium text-sale">
                    {formError}
                  </p>
                )}
                <button type="submit" disabled={submitting} className="btn-primary mt-4 w-full !px-4 text-base">
                  {submitting
                    ? 'Placing Order…'
                    : paymentMethod === 'COD'
                      ? 'Place Order (Cash on Delivery)'
                      : 'Place Order'}
                </button>
                <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-muted">
                  By placing your order you agree to Interwood&rsquo;s Terms of Sale. No payment is charged now unless
                  you choose Card or Installments.
                </p>
              </OrderSummary>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
