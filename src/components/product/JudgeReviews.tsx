'use client';

import { useActionState, useMemo, useState } from 'react';
import { submitReview, type ReviewFormState } from '@/app/(store)/products/[handle]/actions';

export type JudgeReview = {
  id: number;
  author: string;
  rating: number;
  title: string;
  body: string;
  /** ISO date; '' when unknown (no date is shown) */
  createdAt: string;
};

const PER_PAGE = 5;

function Star({ filled, className = 'h-4 w-4' }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.5l2.94 6.24 6.81.82-5.03 4.67 1.33 6.74L12 17.6l-6.05 3.37 1.33-6.74L2.25 9.56l6.81-.82L12 2.5z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stars({ rating, className, gap = 'gap-[3px]' }: { rating: number; className?: string; gap?: string }) {
  const r = Math.round(rating);
  return (
    <span className={`inline-flex text-judge ${gap}`} role="img" aria-label={`${rating.toFixed(2)} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= r} className={className} />
      ))}
    </span>
  );
}

function ddmmyyyy(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Judge.me "Customer Reviews" widget as rendered on live product pages: centred title, summary
 * (stars + "x out of 5", histogram, "Write a review" button) separated by thin teal dividers,
 * sort dropdown and the review list; "Be the first to write a review" when empty.
 */
export function JudgeReviews({ productId, reviews }: { productId: number; reviews: JudgeReview[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [sort, setSort] = useState('most-recent');
  const [page, setPage] = useState(1);
  const count = reviews.length;
  const avg = count ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
  const histogram = [5, 4, 3, 2, 1].map((star) => ({ star, n: reviews.filter((r) => Math.round(r.rating) === star).length }));

  const sorted = useMemo(() => {
    const out = [...reviews];
    if (sort === 'highest-rating') out.sort((a, b) => b.rating - a.rating || b.createdAt.localeCompare(a.createdAt));
    else if (sort === 'lowest-rating') out.sort((a, b) => a.rating - b.rating || b.createdAt.localeCompare(a.createdAt));
    else out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return out;
  }, [reviews, sort]);
  const pages = Math.max(1, Math.ceil(sorted.length / PER_PAGE));
  const shown = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const button = (
    <button
      type="button"
      onClick={() => setFormOpen((o) => !o)}
      className="mx-auto block h-10 w-full max-w-[240px] border-2 border-judge bg-judge px-5 py-[10px] text-[16px] font-bold leading-4 text-white transition-opacity duration-[250ms] ease-theme hover:opacity-80 max-md:max-w-none"
    >
      {formOpen ? 'Cancel review' : 'Write a review'}
    </button>
  );

  return (
    <div id="reviews" className="mx-auto max-w-[1200px] scroll-mt-24 py-4 md:px-4 md:py-6">
      <h2 className="mb-3 text-center text-[25.5px] font-semibold leading-[35.7px] text-accent md:mb-6">Customer Reviews</h2>

      {count === 0 ? (
        // live `.jdgm-row-stars`: stacked on mobile (24px gaps), two 350px columns split by a 1px rule ≥768
        <div className="md:flex md:justify-center md:pb-6">
          <div className="mb-6 text-center md:mb-0 md:flex md:w-[350.4px] md:items-center md:justify-center md:text-left">
            <div>
              <div className="flex h-[23.8px] pt-[3px] max-md:justify-center">
                <Stars rating={0} gap="gap-1" />
              </div>
              <div className="text-[17px] leading-[23.8px] text-accent">Be the first to write a review</div>
            </div>
          </div>
          <div className="mb-6 md:mb-0 md:flex md:w-[350.4px] md:items-center md:border-l md:border-judge/10 md:py-[10px]">
            {button}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-4 border-b border-judge/10 px-4 pb-6 md:flex-row md:items-stretch md:justify-center md:gap-0">
            <div className="flex items-center justify-center md:w-[350px]">
              <div>
                <div className="flex items-center gap-2 text-[17px] leading-[23.8px] text-accent">
                  <Stars rating={avg} />
                  <span>{avg.toFixed(2)} out of 5</span>
                </div>
                <div className="text-[17px] leading-[23.8px] text-accent">
                  Based on {count} review{count === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="hidden w-px bg-judge/10 md:block" />
            <div className="flex items-center justify-center md:w-[468px]">
              <div className="flex flex-col gap-[10px]">
                {histogram.map(({ star, n }) => (
                  <div key={star} className="flex items-center gap-[10px] text-[13.6px] leading-[14px] text-[#7b7b7b]">
                    <Stars rating={star} className="h-[13.6px] w-[13.6px]" gap="gap-[2px]" />
                    <span className="relative block h-[14px] w-[140px] bg-[rgba(224,224,224,0.5)]">
                      <span className="absolute inset-y-0 left-0 bg-judge" style={{ width: `${count ? (n / count) * 100 : 0}%` }} />
                    </span>
                    <span className="w-6">{n}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hidden w-px bg-judge/10 md:block" />
            <div className="flex w-full items-center justify-center md:w-[350px]">{button}</div>
          </div>
        </>
      )}

      {formOpen && <ReviewForm productId={productId} onDone={() => setFormOpen(false)} />}

      {count > 0 && (
        <div className="px-4 md:px-0">
          <div className="border-b border-judge/10 py-5">
            <label className="relative inline-flex items-center text-[14px] text-judge">
              <span className="sr-only">Sort reviews</span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="cursor-pointer appearance-none bg-transparent pr-8 text-[14px] text-judge outline-none"
              >
                <option value="most-recent">Most Recent</option>
                <option value="highest-rating">Highest Rating</option>
                <option value="lowest-rating">Lowest Rating</option>
              </select>
              <svg viewBox="0 0 10 6" className="pointer-events-none absolute right-2 h-[6px] w-[10px]" aria-hidden>
                <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
            </label>
          </div>

          {shown.map((r, i) => (
            <div key={r.id} className={`py-4 ${i > 0 ? 'border-t border-judge/10' : ''}`}>
              <div className="flex items-start justify-between">
                <Stars rating={r.rating} className="h-[18px] w-[18px]" gap="gap-[2px]" />
                {r.createdAt && <span className="text-[13.6px] leading-[19px] text-[#7b7b7b]">{ddmmyyyy(r.createdAt)}</span>}
              </div>
              <div className="mt-[6px] flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center bg-[rgba(224,224,224,0.5)] text-judge">
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
                  </svg>
                </span>
                <span className="text-[17px] leading-[23.8px] text-judge">{r.author}</span>
              </div>
              {r.title && <div className="mb-2 mt-[18px] text-[17px] font-medium leading-[23.8px] text-accent">{r.title}</div>}
              <p className={`text-[17px] leading-[23.8px] text-accent ${r.title ? '' : 'mt-[18px]'}`}>{r.body}</p>
            </div>
          ))}

          {pages > 1 && (
            <div className="flex justify-center gap-3 border-t border-judge/10 py-4 text-[16px] text-judge">
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  aria-current={p === page ? 'page' : undefined}
                  className={p === page ? 'font-bold' : 'opacity-70 hover:opacity-100'}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewForm({ productId, onDone }: { productId: number; onDone: () => void }) {
  const [state, action, pending] = useActionState<ReviewFormState, FormData>(submitReview, null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  if (state?.ok) {
    return (
      <div className="mx-4 my-6 border border-judge/20 p-6 text-center text-[17px] text-accent md:mx-0">
        <p className="font-semibold">{state.message}</p>
        <p className="text-[15px]">Your review will appear once it has been approved.</p>
      </div>
    );
  }

  const field = 'mt-1 w-full border border-judge/30 bg-white px-3 py-2 text-[15px] text-accent outline-none focus:border-judge';
  return (
    <form action={action} className="mx-4 my-6 border-t border-judge/10 pt-6 text-accent md:mx-auto md:max-w-[600px]">
      <h3 className="mb-4 text-center text-[20px] font-semibold leading-tight">Write a review</h3>
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="rating" value={rating || ''} />
      <div className="mb-4 text-center">
        <span className="block text-[14px]">Rating</span>
        <span className="inline-flex gap-1 text-judge" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i} star${i > 1 ? 's' : ''}`}
              onMouseEnter={() => setHover(i)}
              onClick={() => setRating(i)}
            >
              <Star filled={i <= (hover || rating)} className="h-6 w-6" />
            </button>
          ))}
        </span>
      </div>
      <label className="mb-4 block text-[14px]">
        Review Title
        <input name="title" maxLength={100} placeholder="Give your review a title" className={field} />
      </label>
      <label className="mb-4 block text-[14px]">
        Review
        <textarea name="body" required rows={5} placeholder="Write your comments here" className={field} />
      </label>
      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <label className="block text-[14px]">
          Name
          <input name="name" required maxLength={80} placeholder="Enter your name (public)" className={field} />
        </label>
        <label className="block text-[14px]">
          Email
          <input name="email" type="email" required placeholder="Enter your email (private)" className={field} />
        </label>
      </div>
      {state && !state.ok && <p className="mb-3 text-center text-[14px] text-[#e93636]">{state.message}</p>}
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={onDone}
          className="h-10 border-2 border-judge bg-white px-5 text-[16px] font-bold uppercase tracking-[3.2px] text-judge"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-10 border-2 border-judge bg-judge px-5 text-[16px] font-bold uppercase tracking-[3.2px] text-white disabled:opacity-60"
        >
          {pending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
