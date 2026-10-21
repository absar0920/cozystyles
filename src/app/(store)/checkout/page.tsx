import type { Metadata } from 'next';
import { getSettingsMap } from '@/lib/queries';
import { shippingRuleFromSettings } from '@/lib/shipping';
import { CheckoutForm } from './CheckoutForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  description: 'Enter your delivery details and place your order.',
  robots: { index: false, follow: false },
};

export default async function Page() {
  // Server-side so the summary uses the same admin delivery rule /api/orders charges.
  return <CheckoutForm shipping={shippingRuleFromSettings(await getSettingsMap())} />;
}
