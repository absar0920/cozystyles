'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/lib/cart';
import { PAKISTAN_CITIES } from '@/lib/constants';
import { CheckoutShell } from '@/components/checkout/CheckoutShell';
import { OrderSummary, StackedThumbs, type SummaryItem } from '@/components/checkout/OrderSummary';
import { PaymentSelector } from '@/components/checkout/PaymentSelector';
import {
  Checkbox,
  ChevronGlyph,
  FloatingInput,
  FloatingSelect,
  QuestionIcon,
  RadioGroup,
} from '@/components/checkout/fields';
import { CART_NOTE_KEY, blueLink, formatCheckoutPrice, payButtonLabel, primaryButton, provinceForCity } from '@/components/checkout/format';
import { digits, validateCheckout, type CheckoutCustomer } from '@/components/checkout/validation';

type FieldErrors = Record<string, string>;

type Form = {
  contact: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  city: string;
  postalCode: string;
  phone: string;
};

const EMPTY: Form = {
  contact: '',
  firstName: '',
  lastName: '',
  address: '',
  apartment: '',
  city: '',
  postalCode: '',
  phone: '',
};

const SAVED_KEY = 'iw-checkout-info';

const help = (title: string) => (
  <span title={title} className="flex h-[35px] items-center pr-[3px] text-[#707070]">
    <QuestionIcon className="h-[18px] w-[18px]" />
  </span>
);

/** Map the Shopify-shaped form onto our CheckoutCustomer (names/address lines joined). */
function toCustomer(f: Form, notes: string): CheckoutCustomer {
  const contact = f.contact.trim();
  const contactIsPhone = contact !== '' && !contact.includes('@') && digits(contact).length >= 10;
  const address = [f.address.trim(), f.apartment.trim(), f.postalCode.trim()].filter(Boolean).join(', ');
  return {
    name: `${f.firstName.trim()} ${f.lastName.trim()}`.trim(),
    phone: f.phone.trim() || (contactIsPhone ? contact : ''),
    email: contactIsPhone ? '' : contact,
    address,
    city: f.city.trim(),
    province: provinceForCity(f.city),
    notes,
  };
}

function SectionTitle({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return (
    <h2 className={`[font-family:inherit] font-semibold leading-[1.2] text-black ${small ? 'text-[16px]' : 'text-[20px]'}`}>{children}</h2>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, count, hydrated, clear } = useCart();

  const [form, setForm] = useState<Form>(EMPTY);
  const [newsletter, setNewsletter] = useState(true);
  const [saveInfo, setSaveInfo] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('COD');
  const [billing, setBilling] = useState<'same' | 'different'>('same');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [summaryOpen, setSummaryOpen] = useState(false);
  const placed = useRef(false);

  // Prefill the cart note and any saved delivery info.
  useEffect(() => {
    try {
      setNotes(localStorage.getItem(CART_NOTE_KEY) ?? '');
      const saved = localStorage.getItem(SAVED_KEY);
      if (saved) {
        setForm((f) => ({ ...f, ...(JSON.parse(saved) as Partial<Form>) }));
        setSaveInfo(true);
      }
    } catch {
      // storage unavailable
    }
  }, []);

  // Shopify sends an empty checkout back to the cart.
  useEffect(() => {
    if (hydrated && items.length === 0 && !placed.current) router.replace('/cart');
  }, [hydrated, items.length, router]);

  const set = (key: keyof Form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: '' }));
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError('');

    const customer = toCustomer(form, notes);
    const found = validateCheckout(customer, paymentMethod, items.length);
    const fieldErrors: FieldErrors = {
      contact: found.email ?? '',
      firstName: found.name ?? '',
      address: found.address ?? '',
      city: found.city ?? '',
      phone: found.phone ?? '',
    };
    setErrors(fieldErrors);
    if (Object.keys(found).length > 0) {
      setFormError(found.paymentMethod ?? found.items ?? '');
      const first = Object.entries(fieldErrors).find(([, v]) => v)?.[0];
      if (first) document.getElementById(`co-${first}`)?.focus();
      return;
    }

    try {
      if (saveInfo) {
        const { contact, firstName, lastName, address, apartment, city, postalCode, phone } = form;
        localStorage.setItem(
          SAVED_KEY,
          JSON.stringify({ contact, firstName, lastName, address, apartment, city, postalCode, phone }),
        );
      } else localStorage.removeItem(SAVED_KEY);
    } catch {
      // storage unavailable
    }

    setSubmitting(true);
    (async () => {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer,
            paymentMethod,
            items: items.map((i) => ({ productId: i.productId, variantId: i.variantId, qty: i.qty })),
          }),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; orderNumber?: string; error?: string } | null;
        if (res.ok && data?.ok && data.orderNumber) {
          placed.current = true;
          try {
            localStorage.removeItem(CART_NOTE_KEY);
          } catch {
            // storage unavailable
          }
          router.push(`/checkout/success?order=${encodeURIComponent(data.orderNumber)}`);
          clear();
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

  const lines: SummaryItem[] = items
    .slice()
    .reverse()
    .map((i) => ({ key: i.key, title: i.title, variantTitle: i.variantTitle, image: i.image, price: i.price, qty: i.qty }));
  const addressReady = form.address.trim() !== '' && form.city.trim() !== '';
  const summary = (
    <OrderSummary
      items={lines}
      subtotal={subtotal}
      shipping={addressReady ? 'Free' : 'Enter shipping address'}
      shippingPending={!addressReady}
    />
  );

  if (!hydrated || items.length === 0) {
    return <CheckoutShell title="Cozy Furnitures Checkout" aside={null}>{null}</CheckoutShell>;
  }

  const openSummary = () => {
    setSummaryOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const mobileTop = (
    <div className="border-b border-[#dedede] bg-[#f5f5f5]">
      <button
        type="button"
        aria-expanded={summaryOpen}
        aria-controls="mobile-summary"
        onClick={() => setSummaryOpen((o) => !o)}
        className="mx-auto flex h-[63px] w-full max-w-[580px] items-center justify-between px-[14px]"
      >
        <span className="flex items-center gap-[7px] text-[14px] text-[#005bd1]">
          Order summary
          <ChevronGlyph className={`h-3.5 w-3.5 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} />
        </span>
        <strong className="text-[18px] font-semibold leading-[1.35]">{formatCheckoutPrice(subtotal)}</strong>
      </button>
      {summaryOpen && (
        <div id="mobile-summary" className="mx-auto max-w-[580px] px-[14px] pb-[21px] pt-[7px]">
          {summary}
        </div>
      )}
    </div>
  );

  return (
    <CheckoutShell title="Cozy Furnitures Checkout" aside={summary} mobileTop={mobileTop}>
      <form onSubmit={handleSubmit} noValidate>
        {/* Contact */}
        <section>
          <div className="flex items-baseline justify-between">
            <SectionTitle>Contact</SectionTitle>
            <Link href="/account/login" className={`text-[14px] ${blueLink}`}>
              Sign in
            </Link>
          </div>
          <FloatingInput
            id="co-contact"
            label="Email or mobile phone number"
            value={form.contact}
            onValueChange={set('contact')}
            error={errors.contact}
            autoComplete="email"
            className="mt-[14px]"
            trailing={help('In case we need to contact you about your order')}
          />
          <Checkbox id="co-newsletter" checked={newsletter} onChange={setNewsletter} className="mt-[10px]">
            Email me with news and offers
          </Checkbox>
        </section>

        {/* Delivery */}
        <section className="mt-8">
          <SectionTitle>Delivery</SectionTitle>
          {/* 2-col grid: halves for names and City / Postal code (Shopify layout; province is inferred from the city). */}
          <div className="mt-[14px] grid grid-cols-1 gap-[10px] min-[1000px]:grid-cols-2">
            <FloatingSelect id="co-country" label="Country/Region" value="Pakistan" options={['Pakistan']} className="min-[1000px]:col-span-2" />
            <FloatingInput
              id="co-firstName"
              label="First name"
              value={form.firstName}
              onValueChange={set('firstName')}
              error={errors.firstName}
              autoComplete="given-name"
             
            />
            <FloatingInput id="co-lastName" label="Last name" value={form.lastName} onValueChange={set('lastName')} autoComplete="family-name" />
            <FloatingInput
              id="co-address"
              label="Address"
              value={form.address}
              onValueChange={set('address')}
              error={errors.address}
              autoComplete="address-line1"
              className="min-[1000px]:col-span-2"
            />
            <FloatingInput
              id="co-apartment"
              label="Apartment, suite, floor, etc. (optional)"
              value={form.apartment}
              onValueChange={set('apartment')}
              autoComplete="address-line2"
              className="min-[1000px]:col-span-2"
            />
            <FloatingInput
              id="co-city"
              label="City"
              value={form.city}
              onValueChange={set('city')}
              error={errors.city}
              autoComplete="address-level2"
              list="co-city-options"
             
            />
            <datalist id="co-city-options">
              {PAKISTAN_CITIES.filter((c) => c !== 'Other').map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <FloatingInput
              id="co-postalCode"
              label="Postal code (optional)"
              value={form.postalCode}
              onValueChange={set('postalCode')}
              autoComplete="postal-code"
              inputMode="numeric"
             
            />
            <FloatingInput
              id="co-phone"
              label="Phone"
              type="tel"
              value={form.phone}
              onValueChange={set('phone')}
              error={errors.phone}
              autoComplete="tel"
              className="min-[1000px]:col-span-2"
              trailing={help('In case we need to contact you about your order')}
            />
          </div>
          <Checkbox id="co-save" checked={saveInfo} onChange={setSaveInfo} className="mt-[10px]">
            Save this information for next time
          </Checkbox>
        </section>

        {/* Shipping method */}
        <section className="mt-6">
          <SectionTitle small>Shipping method</SectionTitle>
          <div className="mt-[14px]">
            {addressReady ? (
              <RadioGroup
                name="shippingMethod"
                value="free"
                onChange={() => undefined}
                options={[{ value: 'free', label: 'Free Delivery & Installation', aside: <strong className="font-semibold">Free</strong> }]}
              />
            ) : (
              // Live: a start-aligned line centred as a block, so it only looks centred while it fits on one line.
              <div className="flex justify-center rounded-xl bg-[#f5f5f5] p-4">
                <p className="text-[14px] text-[#707070]">Enter your shipping address to view available shipping methods.</p>
              </div>
            )}
          </div>
        </section>

        {/* Payment */}
        <section className="mt-8">
          <SectionTitle>Payment</SectionTitle>
          <p className="mt-1 text-[14px] text-[#707070]">All transactions are secure and encrypted.</p>
          <div className="mt-[14px]">
            <PaymentSelector value={paymentMethod} onChange={setPaymentMethod} />
          </div>
        </section>

        {paymentMethod !== 'CARD' && (
          <section className="mt-8">
            <SectionTitle small>Billing address</SectionTitle>
            <div className="mt-[14px]">
              <RadioGroup<'same' | 'different'>
                name="billing"
                value={billing}
                onChange={setBilling}
                options={[
                  { value: 'same', label: 'Same as shipping address' },
                  {
                    value: 'different',
                    label: 'Use a different billing address',
                    panel: <p>Our team will confirm your billing address on the order confirmation call.</p>,
                  },
                ]}
              />
            </div>
          </section>
        )}

        {/* Mobile: Add discount + total row (live puts these above the pay button below 1000px) */}
        <div className="mt-[34px] min-[1000px]:hidden">
          <button
            type="button"
            onClick={openSummary}
            className="flex h-[37.5px] items-center gap-1 rounded-xl border border-[#dedede] px-[8.33px] text-[14px] font-semibold text-black"
          >
            <svg viewBox="0 0 14 14" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path
                d="M7.6 1.4h4.1a.9.9 0 0 1 .9.9v4.1a.9.9 0 0 1-.26.64l-5.5 5.5a.9.9 0 0 1-1.28 0L1.46 8.44a.9.9 0 0 1 0-1.28l5.5-5.5a.9.9 0 0 1 .64-.26Z"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <circle cx="10" cy="4" r=".9" fill="currentColor" />
            </svg>
            Add discount
          </button>
          <button type="button" onClick={openSummary} className="mt-[11px] flex w-full items-center gap-2 pt-1 text-left">
            <StackedThumbs items={lines} />
            <span className="flex-1">
              <strong className="block text-[18px] font-semibold leading-[18px]">Total</strong>
              <span className="mt-1 block text-[14px] leading-[14px] text-[#707070]">
                {count} {count === 1 ? 'item' : 'items'}
              </span>
            </span>
            <span className="flex items-center gap-[6px]">
              <span className="flex h-[19px] items-center rounded-full bg-[#f5f5f5] px-1 text-[10px] font-semibold text-[#707070]">PKR</span>
              <strong className="text-[18px] font-semibold leading-[18px]">{formatCheckoutPrice(subtotal)}</strong>
            </span>
            <ChevronGlyph className="h-[10px] w-[10px]" />
          </button>
        </div>

        {formError && (
          <p role="alert" className="mt-[21px] rounded-xl border border-[#e32c2b] bg-[#fff4f4] p-[14px] text-[14px] text-[#e32c2b]">
            {formError}
          </p>
        )}

        <button type="submit" disabled={submitting} aria-busy={submitting} className={`${primaryButton} mt-[14px] min-[1000px]:mt-[38px]`}>
          {submitting ? 'Processing…' : payButtonLabel(paymentMethod)}
          {/* Live appends the order total to the label for assistive tech only. */}
          {!submitting && <span className="sr-only"> {formatCheckoutPrice(subtotal)}</span>}
        </button>
      </form>
    </CheckoutShell>
  );
}
