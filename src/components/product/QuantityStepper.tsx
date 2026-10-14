'use client';

import { MinusIcon, PlusIcon } from '@/components/icons';

/** Controlled 1–99 quantity stepper. */
export function QuantityStepper({
  value,
  onChange,
  max = 99,
}: {
  value: number;
  onChange: (next: number) => void;
  max?: number;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(1, Math.round(n) || 1));
  return (
    <div className="inline-flex items-stretch overflow-hidden rounded-full border-0 bg-cream-soft">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 1}
        className="flex w-10 items-center justify-center text-ink-dark transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:text-ink-light disabled:hover:bg-transparent"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span aria-live="polite" className="flex w-12 items-center justify-center text-sm font-semibold text-ink-dark">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="flex w-10 items-center justify-center text-ink-dark transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:text-ink-light disabled:hover:bg-transparent"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
