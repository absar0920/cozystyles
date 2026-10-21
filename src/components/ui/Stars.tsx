import { StarIcon } from '@/components/icons';

export function Stars({ rating, count, size = 'sm' }: { rating: number; count?: number; size?: 'sm' | 'md' }) {
  // A product with zero reviews has no rating to show.
  if (count === 0) return null;
  const cls = size === 'md' ? 'h-4.5 w-4.5' : 'h-3.5 w-3.5';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex text-[#f5a623]">
        {[1, 2, 3, 4, 5].map((i) => (
          <StarIcon key={i} className={cls} filled={rating >= i - 0.5} />
        ))}
      </div>
      {count != null && count > 0 && <span className="text-[11px] text-ink-muted">({count})</span>}
    </div>
  );
}
