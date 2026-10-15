'use client';

import { PAYMENT_LABELS, type PaymentMethod } from '@/components/checkout/format';
import { AmexBadge, MastercardBadge, RadioGroup, UnionPayBadge, VisaBadge } from '@/components/checkout/fields';

const BANK_DETAILS: [string, string][] = [
  ['Bank', 'Meezan Bank Limited'],
  ['Account title', 'Cozy Furnitures (Pvt.) Ltd.'],
  ['Account number', '0123-0101234567'],
  ['IBAN', 'PK36MEZN0001230101234567'],
  ['Branch', 'Gulberg III, Lahore'],
];

function Badges({ children }: { children: React.ReactNode }) {
  return <span className="flex shrink-0 gap-1">{children}</span>;
}

/** Shopify payment radio-accordion: bordered group, brand tiles, grey expanded panel. */
export function PaymentSelector({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <RadioGroup<PaymentMethod>
      name="paymentMethod"
      value={value as PaymentMethod}
      onChange={onChange}
      options={[
        {
          value: 'COD',
          label: PAYMENT_LABELS.COD,
          panel: <p className="text-center">Pay in cash when our team delivers and installs your furniture at your doorstep.</p>,
        },
        {
          value: 'CARD',
          label: PAYMENT_LABELS.CARD,
          aside: (
            <Badges>
              <VisaBadge />
              <MastercardBadge />
              <AmexBadge />
            </Badges>
          ),
          panel: <p className="text-center">You&apos;ll receive a secure payment link after order confirmation.</p>,
        },
        {
          value: 'INSTALLMENTS',
          label: PAYMENT_LABELS.INSTALLMENTS,
          aside: (
            <Badges>
              <VisaBadge />
              <MastercardBadge />
              <UnionPayBadge />
            </Badges>
          ),
          panel: <p className="text-center">You&apos;ll be redirected to Installments Plans to complete your purchase</p>,
        },
        {
          value: 'BANK_TRANSFER',
          label: PAYMENT_LABELS.BANK_TRANSFER,
          panel: (
            <div>
              <p>Bank Transfer Payment</p>
              <dl className="mt-[10px] grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {BANK_DETAILS.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-[#707070]">{k}</dt>
                    <dd className="break-all">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-[10px] text-[#707070]">
                After placing your order, share your transfer receipt at +92-42-111-269-926 so we can confirm your payment.
              </p>
            </div>
          ),
        },
      ]}
    />
  );
}
