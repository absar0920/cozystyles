import type { Metadata } from 'next';
import { TrackForm } from '@/components/checkout/TrackForm';

export const metadata: Metadata = {
  title: 'Track Your Order',
  description: 'Enter your order number and mobile number to check the latest delivery status.',
};

/** Live /pages/track-your-order: one white card on a #f6f6f4 band between header and footer. */
export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;

  return (
    <section className="bg-[#f6f6f4] px-3 py-[30px] md:px-4 md:py-[50px]">
      <div className="mx-auto max-w-[860px]">
        <TrackForm initialOrder={(order ?? '').trim()} />
      </div>
    </section>
  );
}
