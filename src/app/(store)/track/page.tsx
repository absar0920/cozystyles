import type { Metadata } from 'next';
import { TruckIcon } from '@/components/icons';
import { TrackForm } from '@/components/checkout/TrackForm';

export const metadata: Metadata = {
  title: 'Track Your Order | Cozy Furnitures',
  description: 'Track your Cozy Furnitures order status — from production to delivery and free installation.',
};

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;

  return (
    <div className="bg-cream-soft py-10 sm:py-14">
      <div className="container-iw">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand">
            <TruckIcon className="h-7 w-7" />
          </span>
          <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-brand">Order Tracking</p>
          <h1 className="mt-1.5 font-heading text-2xl font-bold text-ink-dark sm:text-3xl">Track Your Order</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">
            Enter your order number and the phone number you used at checkout to see the live status of your furniture.
          </p>
        </div>
        <TrackForm initialOrder={(order ?? '').trim()} />
      </div>
    </div>
  );
}
