/**
 * Live Judge.me-style text stars: "★★★★★" in Times, filled #103a3a up to the rating, #e1e1e1 after.
 * `size="sm"` = 16px, `size="md"` = 19.2px (product-card size). Optional count is shown as "(n)".
 */
export function Stars({ rating, count, size = 'sm' }: { rating: number; count?: number; size?: 'sm' | 'md' }) {
  const pct = `${Math.max(0, Math.min(5, rating)) * 20}%`;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`star-rating ${size === 'md' ? 'text-[19.2px]' : 'text-[16px]'}`}
        style={{ ['--rating' as string]: pct }}
        role="img"
        aria-label={`${rating.toFixed(1)} out of 5 stars`}
      >
        ★★★★★
      </span>
      {count != null && count > 0 && <span className="text-[13px] leading-none text-accent">({count})</span>}
    </span>
  );
}
