import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckIcon, CubeIcon, MapPinIcon, PhoneIcon, TruckIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Order Confirmed | Cozy Furnitures',
  description: 'Thank you for your order — Cozy Furnitures will confirm your order by phone shortly.',
};

const NEXT_STEPS = [
  {
    icon: PhoneIcon,
    title: 'Confirmation Call',
    text: 'Our team will call you within 24 hours to confirm your order and any customisation details.',
  },
  {
    icon: TruckIcon,
    title: 'Delivery Scheduling',
    text: 'We will schedule a delivery slot that works for you. Delivery is free, nationwide.',
  },
  {
    icon: CubeIcon,
    title: 'Free Installation',
    text: 'Our specialists deliver and install your furniture at your home — at no extra cost.',
  },
] as const;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const orderNumber = (order ?? '').trim();

  return (
    <div className="bg-cream-soft py-12 sm:py-16">
      <div className="container-iw">
        <div className="mx-auto max-w-2xl animate-fadeIn overflow-hidden rounded-2xl border border-cream-border bg-white shadow-card">
          <div className="bg-brand px-6 py-10 text-center text-white sm:py-12">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/25">
              <CheckIcon className="h-10 w-10" strokeWidth={2.4} />
            </span>
            <h1 className="mt-5 font-heading text-2xl font-bold sm:text-3xl">Thank You!</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/85">
              {orderNumber ? (
                <>
                  Your order{' '}
                  <span className="font-semibold text-white">#{orderNumber}</span> has been placed successfully.
                </>
              ) : (
                <>Your order has been placed successfully.</>
              )}
            </p>
            {orderNumber && (
              <p className="mx-auto mt-5 inline-block rounded-lg bg-brand-900/60 px-5 py-2.5 font-mono text-sm font-semibold tracking-wider">
                {orderNumber}
              </p>
            )}
          </div>

          <div className="px-6 py-8 sm:px-8">
            <h2 className="text-center font-heading text-sm font-semibold uppercase tracking-widest text-ink-muted">
              What happens next
            </h2>
            <ol className="mt-6 space-y-5">
              {NEXT_STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="pt-1">
                    <span className="block text-sm font-semibold text-ink-dark">
                      {i + 1}. {step.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>

            <p className="mt-7 flex items-start gap-2 rounded-lg bg-cream px-4 py-3 text-xs leading-relaxed text-ink">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              Questions in the meantime? Call us at +92-42-111-203-203 — Pakistan&rsquo;s largest furniture
              manufacturer is at your service.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/track${orderNumber ? `?order=${encodeURIComponent(orderNumber)}` : ''}`}
                className="btn-outline flex-1"
              >
                Track Your Order
              </Link>
              <Link href="/" className="btn-primary flex-1">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
