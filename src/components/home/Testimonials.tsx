'use client';

import Link from 'next/link';
import type { HomeReview } from './homeReviews';
import { useDragTrack } from './useDragTrack';
import { useWrapPosition } from './useWrapPosition';

/**
 * The Judge.me `JudgemeStar` font glyph (U+E000, 512-unit em, ascent 437), rendered bold the way
 * live sets it (`font-weight: bold` on a regular-only font, so Chrome fake-bolds the outline).
 */
function StarIcon({ className, top }: { className?: string; top: number }) {
  return (
    <svg viewBox={`0 ${top} 512 512`} className={`shrink-0 overflow-visible ${className ?? ''}`} aria-hidden fill="currentColor">
      <path
        transform="scale(1 -1)"
        stroke="currentColor"
        strokeWidth="18"
        strokeLinejoin="round"
        d="M512 247Q512 258 495 261L340 284L271 424Q265 436 256 436Q247 436 241 424L172 284L17 261Q0 258 0 247Q0 240 8 232L120 123L93 -31Q93 -35 93 -37Q93 -43 96 -47.5Q99 -52 106 -52Q111 -52 118 -48L256 24L394 -48Q401 -52 406 -52Q413 -52 416 -47.5Q419 -43 419 -37Q419 -33 419 -31L392 123L504 232Q512 240 512 247Z"
      />
    </svg>
  );
}

/** `top` is the viewBox origin in font units: -437 puts the em box like an inline 16px span (header);
 * the card's 24px block span sits its glyph ~0.7px lower. */
function Stars({ className, gap, top = -437 }: { className: string; gap: string; top?: number }) {
  return (
    <span className={`flex ${gap}`} role="img" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} className={className} top={top} />
      ))}
    </span>
  );
}

/** Judge.me `.jdgm-reviewer-verified-icon`: a 20px box masked with a 16px check-in-circle. */
function VerifiedIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0 text-black" aria-label="Verified" role="img" fill="currentColor">
      <path d="M8.9375 10.875L7.6875 9.64583C7.53472 9.49306 7.36111 9.41667 7.16667 9.41667C6.97222 9.41667 6.79861 9.49306 6.64583 9.64583C6.49306 9.79861 6.41667 9.97569 6.41667 10.1771C6.41667 10.3785 6.49306 10.5556 6.64583 10.7083L8.41667 12.4792C8.56944 12.6319 8.74306 12.7083 8.9375 12.7083C9.13194 12.7083 9.30556 12.6319 9.45833 12.4792L13.3542 8.58333C13.5069 8.43056 13.5833 8.25347 13.5833 8.05208C13.5833 7.85069 13.5069 7.67361 13.3542 7.52083C13.2014 7.36806 13.0278 7.29167 12.8333 7.29167C12.6389 7.29167 12.4653 7.36806 12.3125 7.52083L8.9375 10.875ZM10 18C8.90278 18 7.86806 17.7917 6.89583 17.375C5.92361 16.9583 5.07292 16.3854 4.34375 15.6562C3.61458 14.9271 3.04167 14.0764 2.625 13.1042C2.20833 12.1319 2 11.0972 2 10C2 8.88889 2.20833 7.85069 2.625 6.88542C3.04167 5.92014 3.61458 5.07292 4.34375 4.34375C5.07292 3.61458 5.92361 3.04167 6.89583 2.625C7.86806 2.20833 8.90278 2 10 2C11.1111 2 12.1493 2.20833 13.1146 2.625C14.0799 3.04167 14.9271 3.61458 15.6562 4.34375C16.3854 5.07292 16.9583 5.92014 17.375 6.88542C17.7917 7.85069 18 8.88889 18 10C18 11.0972 17.7917 12.1319 17.375 13.1042C16.9583 14.0764 16.3854 14.9271 15.6562 15.6562C14.9271 16.3854 14.0799 16.9583 13.1146 17.375C12.1493 17.7917 11.1111 18 10 18Z" />
    </svg>
  );
}

function Arrow({ dir, onClick }: { dir: 'prev' | 'next'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'prev' ? 'Previous slide' : 'Next slide'}
      className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-black md:flex"
    >
      <svg viewBox="0 0 20 34" className="h-[34px] w-5" fill="none" aria-hidden>
        <path
          d={dir === 'prev' ? 'M16 6L6 17L16 28' : 'M4 6L14 17L4 28'}
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function ReviewCard({ review, hidden, eager }: { review: HomeReview; hidden: boolean; eager: boolean }) {
  return (
    <div
      className="flex w-[225px] shrink-0 flex-col self-stretch overflow-hidden rounded-[8px] bg-[#f9f9f9] md:w-[230px]"
      aria-hidden={hidden || undefined}
    >
      {review.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={review.image} alt="" loading={eager ? 'eager' : 'lazy'} draggable={false} className="aspect-square w-full object-cover" />
      )}
      <div className="grid flex-1 place-items-center px-4 pt-4">
        <p
          className={`m-0 overflow-hidden px-2 text-center text-[14px] font-normal leading-[16.8px] text-black [-webkit-box-orient:vertical] [display:-webkit-box] ${
            review.image ? '[-webkit-line-clamp:4]' : '[-webkit-line-clamp:8]'
          }`}
        >
          {review.body}
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 px-4 pb-4 pt-3">
        <Stars className="h-6 w-6 text-judge" gap="gap-1" top={-452} />
        <div className="flex items-center justify-center gap-1">
          <span className="text-[16px] font-semibold leading-6 text-black">{review.author}</span>
          {review.verified !== false && <VerifiedIcon />}
        </div>
        <Link
          href={review.href}
          target="_blank"
          tabIndex={hidden ? -1 : 0}
          draggable={false}
          className="block w-full truncate text-center text-[14px] font-normal leading-[1.5] text-[#7b7b7b] hover:text-[#7b7b7b]"
        >
          {review.productTitle}
        </Link>
      </div>
    </div>
  );
}

/**
 * Live Judge.me "cards carousel": header stars + "4.92 ★ (102)", then 230px #f9f9f9 cards
 * (4 visible desktop, 1 mobile) between black chevrons. Infinite wrap, one card per click,
 * swipe on touch, no autoplay. Arrows are hidden on mobile.
 */
export function Testimonials({ reviews, rating, count }: { reviews: HomeReview[]; rating: string; count: string }) {
  const n = reviews.length;
  const { pos, animate, move, onTransitionEnd } = useWrapPosition(n);
  const { offset, dragging, handlers } = useDragTrack((dx) => move(Math.round(-dx / 245) || (dx < 0 ? 1 : -1)));

  if (n === 0) return null;
  const cells = [...reviews, ...reviews, ...reviews];
  const visible = (i: number) => i >= pos && i < pos + 4;
  // The track starts translated deep into the middle copy, where the browser's lazy-load heuristic
  // misses the on-screen cards; the visible slides (plus one either side) load eagerly instead.

  return (
    <section className="mx-auto max-w-[1100px] py-5 text-center" aria-label="Customer reviews">
      <div className="mb-10 flex items-center justify-center gap-2 pt-2 leading-[25px]">
        <span className="h-[25px] pt-1">
          <Stars className="h-4 w-4 text-black" gap="gap-1" />
        </span>
        <span className="text-[16px] font-normal text-black">
          {rating} ★ ({count})
        </span>
      </div>

      <div className="mb-10 flex items-center justify-center gap-5">
        <Arrow dir="prev" onClick={() => move(-1)} />
        <div className="w-full max-w-[225px] overflow-hidden md:max-w-[980px]">
          <div
            className={`flex touch-pan-y select-none gap-5 [--pitch:245px] md:[--pitch:250px] ${
              animate && !dragging ? 'transition-transform duration-500 ease-in-out' : ''
            }`}
            style={{ transform: `translateX(calc(${-pos} * var(--pitch) + ${offset}px))` }}
            onTransitionEnd={onTransitionEnd}
            {...handlers}
          >
            {cells.map((r, i) => (
              <ReviewCard key={i} review={r} hidden={!visible(i)} eager={i >= pos - 1 && i < pos + 5} />
            ))}
          </div>
        </div>
        <Arrow dir="next" onClick={() => move(1)} />
      </div>
    </section>
  );
}
