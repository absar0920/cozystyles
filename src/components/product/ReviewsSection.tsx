import { Stars } from '@/components/ui/Stars';

export type ReviewData = {
  id: number;
  author: string;
  rating: number;
  title: string;
  body: string;
  createdAt: Date;
};

const dateFormatter = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Server-rendered customer reviews block with stars summary. */
export function ReviewsSection({
  rating,
  reviewCount,
  reviews,
}: {
  rating: number;
  reviewCount: number;
  reviews: ReviewData[];
}) {
  return (
    <section id="reviews" aria-labelledby="reviews-heading" className="container-iw scroll-mt-24 py-9 lg:py-12">
      <h2 id="reviews-heading" className="mb-6 font-heading text-xl font-semibold text-ink-dark sm:text-2xl">
        Customer Reviews
      </h2>

      <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        {/* Summary */}
        <div className="h-fit rounded-2xl border-0 bg-white p-5 text-center shadow-card lg:text-left">
          <p className="font-heading text-4xl font-bold text-ink-dark">{rating.toFixed(1)}</p>
          <div className="mt-2 flex justify-center lg:justify-start">
            <Stars rating={rating} size="md" />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Based on <span className="font-semibold text-ink-dark">{reviewCount.toLocaleString('en-PK')}</span>{' '}
            {reviewCount === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        {/* Review list */}
        {reviews.length === 0 ? (
          <div className="flex items-center rounded-2xl border border-dashed border-cream-border bg-white/60 p-8 text-sm text-ink-muted">
            This product hasn&rsquo;t been reviewed yet. Be the first to share your experience with it.
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {reviews.map((review) => (
              <li key={review.id} className="flex flex-col gap-2 rounded-2xl border-0 bg-cream-soft p-4.5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-ink-dark">{review.author}</span>
                  <time dateTime={new Date(review.createdAt).toISOString()} className="shrink-0 text-[11px] text-ink-light">
                    {dateFormatter.format(new Date(review.createdAt))}
                  </time>
                </div>
                <Stars rating={review.rating} />
                {review.title && <p className="text-sm font-semibold text-ink-dark">{review.title}</p>}
                <p className="text-[13px] leading-relaxed text-ink">{review.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
