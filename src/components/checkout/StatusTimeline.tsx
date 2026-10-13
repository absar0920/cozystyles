import { CheckIcon, PackageIcon, TruckIcon } from '@/components/icons';

const STEPS = [
  { value: 'PENDING', label: 'Order Placed', note: 'We have received your order' },
  { value: 'CONFIRMED', label: 'Order Confirmed', note: 'Confirmed by our team over phone' },
  { value: 'PROCESSING', label: 'In Production', note: 'Your furniture is being crafted' },
  { value: 'SHIPPED', label: 'Shipped', note: 'On its way to your address' },
  { value: 'DELIVERED', label: 'Delivered & Installed', note: 'Enjoy your new furniture' },
] as const;

/**
 * Vertical order-status timeline: PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED.
 * CANCELLED renders a dedicated notice instead of the timeline.
 */
export function StatusTimeline({ status }: { status: string }) {
  if (status === 'CANCELLED') {
    return (
      <div className="rounded-lg border border-sale/30 bg-sale/5 px-5 py-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-sale">Order Cancelled</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          This order has been cancelled. If you believe this is a mistake, please contact us at +92-42-111-203-203.
        </p>
      </div>
    );
  }

  const currentIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.value === status),
  );

  return (
    <ol className="relative">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        const last = i === STEPS.length - 1;
        return (
          <li key={step.value} className="relative flex gap-4 pb-7 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={`absolute left-[15px] top-9 h-[calc(100%-2rem)] w-0.5 ${done ? 'bg-brand' : 'bg-cream-border'}`}
              />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                done
                  ? 'border-brand bg-brand text-white'
                  : current
                    ? 'border-brand bg-white text-brand'
                    : 'border-cream-border bg-white text-ink-light'
              }`}
            >
              {done ? (
                <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
              ) : current ? (
                step.value === 'SHIPPED' ? (
                  <TruckIcon className="h-4 w-4" />
                ) : step.value === 'PROCESSING' ? (
                  <PackageIcon className="h-4 w-4" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-brand" />
                )
              ) : (
                <span className="h-2 w-2 rounded-full bg-cream-border" />
              )}
            </span>
            <span className="pt-1">
              <span
                className={`block text-sm font-semibold ${
                  done || current ? 'text-ink-dark' : 'text-ink-light'
                }`}
              >
                {step.label}
                {current && (
                  <span className="ml-2 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Current
                  </span>
                )}
              </span>
              <span className={`mt-0.5 block text-xs ${done || current ? 'text-ink-muted' : 'text-ink-light/80'}`}>
                {step.note}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
