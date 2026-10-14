'use client';

import { PAYMENT_METHODS } from '@/lib/constants';
import { CheckIcon, ShieldIcon } from '@/components/icons';

/**
 * Payment method radio cards with contextual info boxes.
 * Used on /checkout.
 */
export function PaymentSelector({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div>
      <div className="space-y-2.5">
        {PAYMENT_METHODS.map((m) => {
          const selected = value === m.value;
          return (
            <label
              key={m.value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3.5 transition ${
                selected ? 'border-brand bg-brand-50' : 'border-cream-border bg-white hover:border-brand-200'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={m.value}
                checked={selected}
                onChange={() => onChange(m.value)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  selected ? 'border-brand bg-brand text-white' : 'border-ink-light bg-white'
                }`}
              >
                {selected && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink-dark">{m.label}</span>
                <span className="block text-xs text-ink-muted">{m.note}</span>
              </span>
            </label>
          );
        })}
      </div>

      {value === 'COD' && (
        <p className="mt-3 rounded-lg bg-cream px-4 py-3 text-xs leading-relaxed text-ink">
          Pay in cash when our team delivers and installs your furniture at your doorstep.
        </p>
      )}

      {value === 'CARD' && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-xs leading-relaxed text-ink">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          You will receive a secure payment link after order confirmation.
        </p>
      )}

      {value === 'BANK_TRANSFER' && (
        <div className="mt-3 rounded-lg border border-cream-border bg-cream px-4 py-3.5 text-xs leading-relaxed text-ink">
          <p className="mb-2 text-sm font-semibold text-ink-dark">Cozy Furnitures Bank Details</p>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
            <dt className="text-ink-muted">Bank</dt>
            <dd className="font-medium text-ink-dark">Meezan Bank Limited</dd>
            <dt className="text-ink-muted">Account Title</dt>
            <dd className="font-medium text-ink-dark">Cozy Furnitures (Pvt.) Ltd.</dd>
            <dt className="text-ink-muted">Account Number</dt>
            <dd className="font-mono font-medium text-ink-dark">0123-0101234567</dd>
            <dt className="text-ink-muted">IBAN</dt>
            <dd className="font-mono font-medium text-ink-dark">PK36MEZN0001230101234567</dd>
            <dt className="text-ink-muted">Branch</dt>
            <dd className="font-medium text-ink-dark">Gulberg III, Lahore</dd>
          </dl>
          <p className="mt-2.5 text-ink-muted">
            After placing your order, please share your transfer receipt with us at +92-42-111-203-203 so we can confirm
            your payment.
          </p>
        </div>
      )}

      {value === 'INSTALLMENTS' && (
        <p className="mt-3 rounded-lg border border-terra/30 bg-terra/5 px-4 py-3 text-xs leading-relaxed text-ink">
          <span className="font-semibold text-terra">Baadmay:</span> buy now and pay later in 3 easy monthly installments
          with 0% markup — available on orders above Rs. 50,000. You will receive a Baadmay checkout link after order
          confirmation.
        </p>
      )}
    </div>
  );
}
