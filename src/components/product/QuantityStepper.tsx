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
    <div className="inline-flex items-stretch overflow-hidden rounded-md border border-cream-border bg-white">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 1}
        className="flex w-10 items-center justify-center text-ink-dark transition hover:bg-cream disabled:cursor-not-allowed disabled:text-ink-light"
      >
        <MinusIcon className="h-4 w-4" />
      </button>
      <span aria-live="polite" className="flex w-12 items-center justify-center border-x border-cream-border text-sm font-semibold text-ink-dark">
        {value}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        className="flex w-10 items-center justify-center text-ink-dark transition hover:bg-cream disabled:cursor-not-allowed disabled:text-ink-light"
      >
        <PlusIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
