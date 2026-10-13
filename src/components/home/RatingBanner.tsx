import { CheckIcon } from '@/components/icons';
import { Stars } from '@/components/ui/Stars';

/** Centered social-proof band: aggregate rating + verified review count. */
export function RatingBanner({
  rating = '4.92',
  count = '2,500+ verified reviews',
}: {
  rating?: string;
  count?: string;
}) {
  const numericRating = Number.parseFloat(rating) || 4.92;
  return (
    <section aria-label="Customer rating" className="bg-brand-50">
      <div className="container-iw flex flex-col items-center gap-3 py-9 text-center lg:py-11">
        <div className="flex items-end gap-3">
          <span className="font-heading text-5xl font-bold leading-none text-brand-900 sm:text-6xl">
            {rating}
          </span>
          <span className="pb-1.5 text-sm font-medium text-ink-muted">out of 5</span>
        </div>
        <Stars rating={numericRating} size="md" />
        <p className="text-sm font-medium text-ink sm:text-[15px]">({count})</p>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand">
          <CheckIcon className="h-3.5 w-3.5" aria-hidden />
          Verified
        </p>
        <p className="text-xs text-ink-muted">
          Trusted by families &amp; businesses across Pakistan since 1974
        </p>
      </div>
    </section>
  );
}
