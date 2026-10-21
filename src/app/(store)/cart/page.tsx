import type { Metadata } from 'next';
import { getSettingsMap } from '@/lib/queries';
import { shippingRuleFromSettings } from '@/lib/shipping';
import { CartView } from './CartView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your Cart',
  description: 'Review the furniture in your cart before checkout.',
  robots: { index: false, follow: false },
};

export default async function Page() {
  // Server-side so the summary uses the same admin delivery rule /api/orders charges.
  return <CartView shipping={shippingRuleFromSettings(await getSettingsMap())} />;
}
