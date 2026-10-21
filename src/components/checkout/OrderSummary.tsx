import { formatPKR } from '@/lib/money';
import { TruckIcon } from '@/components/icons';
import { shippingFeeFor, type ShippingRule } from '@/lib/shipping';

export type SummaryItem = {
  key?: string;
  title: string;
  variantTitle?: string;
  image?: string;
  price: number;
  compareAtPrice?: number | null;
  qty: number;
};

/**
 * Shared order summary card used on /cart and /checkout.
 * Pure presentational — safe in client components.
 */
export function OrderSummary({
  items = [],
  subtotal,
  savings,
  shipping,
  showItems = true,
  children,
}: {
  items?: SummaryItem[];
  subtotal: number;
  savings: number;
  /** Admin-configured delivery rule; must match what /api/orders charges. */
  shipping: ShippingRule;
  showItems?: boolean;
  children?: React.ReactNode;
}) {
  const shippingFee = shippingFeeFor(subtotal, shipping);
  const total = subtotal + shippingFee;
  const toFree = shipping.freeThreshold - subtotal;
  return (
    <div className="rounded-xl border border-cream-border bg-white p-5 shadow-card">
      <h2 className="font-heading text-base font-semibold text-ink-dark">Order Summary</h2>

      {showItems && (
        <ul className="mt-4 space-y-3 border-b border-cream-border pb-4">
          {items.map((item, idx) => (
            <li key={item.key ?? idx} className="flex items-center gap-3">
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-cream-border bg-cream-soft">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-[11px] font-semibold text-ink-light">IW</span>
                )}
                <span className="absolute -right-0 -top-0 rounded-bl-md bg-ink-dark/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  ×{item.qty}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink-dark" title={item.title}>
                  {item.title}
                </span>
                {item.variantTitle && item.variantTitle !== 'Default Title' && (
                  <span className="block truncate text-xs text-ink-muted">{item.variantTitle}</span>
                )}
              </span>
              <span className="shrink-0 text-sm font-semibold text-ink-dark">{formatPKR(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-4 space-y-2.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-muted">Subtotal</dt>
          <dd className="font-semibold text-ink-dark">{formatPKR(subtotal)}</dd>
        </div>
        {savings > 0 && (
          <div className="flex items-center justify-between">
            <dt className="text-ink-muted">You save</dt>
            <dd className="font-semibold text-brand">-{formatPKR(savings)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="flex items-center gap-1.5 text-ink-muted">
            <TruckIcon className="h-4 w-4 text-brand" />
            Delivery &amp; Installation
          </dt>
          {shippingFee > 0 ? (
            <dd className="font-semibold text-ink-dark">{formatPKR(shippingFee)}</dd>
          ) : (
            <dd className="font-semibold uppercase tracking-wide text-brand">Free</dd>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-cream-border pt-3 text-base">
          <dt className="font-heading font-semibold text-ink-dark">Total</dt>
          <dd className="font-heading text-lg font-bold text-brand">{formatPKR(total)}</dd>
        </div>
      </dl>

      {shippingFee > 0 && toFree > 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Add {formatPKR(toFree)} more for free delivery &amp; installation.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
        Pay on your terms — Cash on Delivery, Card, Bank Transfer or Easy Installments available at checkout.
      </p>

      {children}
    </div>
  );
}
