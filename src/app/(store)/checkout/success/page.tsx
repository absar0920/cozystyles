import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { CheckoutShell } from '@/components/checkout/CheckoutShell';
import { OrderSummary } from '@/components/checkout/OrderSummary';

import { PAYMENT_LABELS, blueLink, primaryButton, type PaymentMethod } from '@/components/checkout/format';
import { formatCheckoutPrice } from '@/components/checkout/format';

export const metadata: Metadata = {
  title: 'Thank you for your purchase!',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

/** "03001234898" → "03XX XXX X898" — the thank-you URL carries only the order number, so mask PII. */
function maskPhone(phone: string): string {
  const d = phone.replace(/\D+/g, '');
  if (d.length < 4) return '';
  return `${d.slice(0, 2)}XX XXX X${d.slice(-3)}`;
}

/** "ahmed@example.com" → "a****@example.com". */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '';
  return `${user[0]}${'*'.repeat(Math.max(3, user.length - 1))}@${domain}`;
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[14px] font-semibold leading-[1.35]">{title}</h3>
      <div className="mt-[6px] text-[14px] leading-[1.5] text-[#707070]">{children}</div>
    </div>
  );
}

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  const orderNumber = (order ?? '').trim().toUpperCase().slice(0, 40);

  const found = orderNumber
    ? await prisma.order.findUnique({ where: { orderNumber }, include: { items: true } }).catch(() => null)
    : null;

  const firstName = found?.customerName.trim().split(/\s+/)[0] ?? '';
  const payment = found ? (PAYMENT_LABELS[found.paymentMethod as PaymentMethod] ?? found.paymentMethod) : '';
  const trackHref = `/track${orderNumber ? `?order=${encodeURIComponent(orderNumber)}` : ''}`;

  const aside = found ? (
    <OrderSummary
      items={found.items.map((i) => ({
        key: String(i.id),
        title: i.title,
        variantTitle: i.variantTitle,
        image: i.image,
        price: i.price,
        qty: i.quantity,
      }))}
      subtotal={found.subtotal}
      total={found.total}
      shipping={found.shippingFee > 0 ? formatCheckoutPrice(found.shippingFee) : 'Free'}
      showDiscount={false}
    />
  ) : null;

  return (
    <CheckoutShell title="Cozy Furnitures — Order confirmed" aside={aside}>
      <div className="flex items-center gap-[14px]">
        <svg viewBox="0 0 50 50" fill="none" className="h-[50px] w-[50px] shrink-0 text-[#005bd1]" aria-hidden>
          <circle cx="25" cy="25" r="24" stroke="currentColor" strokeWidth="2" />
          <path d="m15.5 25.5 6.5 6.5 13-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          {orderNumber && <p className="text-[14px] text-[#707070]">Confirmation #{orderNumber}</p>}
          <h2 className="text-[24px] font-semibold leading-[1.25]">{firstName ? `Thank you, ${firstName}!` : 'Thank you!'}</h2>
        </div>
      </div>

      <section className="mt-[21px] rounded-xl border border-[#dedede] p-5">
        <h3 className="text-[16px] font-semibold leading-[1.35]">Your order is confirmed</h3>
        <p className="mt-[6px] text-[14px] leading-[1.5] text-[#707070]">
          {found?.email
            ? "You'll receive a confirmation email with your order number shortly. Our team will also call you to confirm delivery."
            : "You'll receive a confirmation call shortly with your order details."}
        </p>
      </section>

      {found && (
        <section className="mt-[14px] rounded-xl border border-[#dedede] p-5">
          <h3 className="text-[16px] font-semibold leading-[1.35]">Order details</h3>
          <div className="mt-[14px] grid grid-cols-1 gap-[21px] sm:grid-cols-2">
            <DetailBlock title="Contact information">
              {found.email && <p className="break-all">{maskEmail(found.email)}</p>}
              <p>{maskPhone(found.phone)}</p>
            </DetailBlock>
            <DetailBlock title="Payment method">
              <p>
                {payment} · <span className="text-black">{formatCheckoutPrice(found.total)}</span>
              </p>
            </DetailBlock>
            <DetailBlock title="Shipping address">
              <p>{firstName}</p>
              <p>
                {found.city}, {found.province}
              </p>
              <p>Pakistan</p>
            </DetailBlock>
            <DetailBlock title="Billing address">
              <p>Same as shipping address</p>
            </DetailBlock>
            <DetailBlock title="Shipping method">
              <p>Free Delivery &amp; Installation</p>
            </DetailBlock>
          </div>
        </section>
      )}

      {/* Mobile: the summary pane is desktop-only, so show the order lines inline. */}
      {aside && (
        <section className="mt-[14px] rounded-xl bg-[#f5f5f5] p-[14px] min-[1000px]:hidden">
          <h3 className="mb-[14px] text-[16px] font-semibold leading-[1.35]">Order summary</h3>
          {aside}
        </section>
      )}

      <div className="mt-[21px] flex flex-col-reverse items-stretch gap-[14px] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[14px]">
          Need help?{' '}
          <Link href="/pages/contact" className={blueLink}>
            Contact us
          </Link>
          <span className="text-[#707070]"> · </span>
          <Link href={trackHref} className={blueLink}>
            Track your order
          </Link>
        </p>
        <Link href="/" className={`${primaryButton} hover:text-white sm:w-auto`}>
          Continue shopping
        </Link>
      </div>
    </CheckoutShell>
  );
}
