'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { Stars } from '@/components/ui/Stars';

export type Testimonial = {
  id: number;
  author: string;
  rating: number;
  title: string;
  body: string;
  product: { handle: string; title: string } | null;
};

/** "Our customer speaks for us" — swipeable review carousel. */
export function Testimonials({ reviews }: { reviews: Testimonial[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  };

  useEffect(() => {
    updateArrows();
    window.addEventListener('resize', updateArrows);
    return () => window.removeEventListener('resize', updateArrows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews.length]);

  if (reviews.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section className="bg-cream">
      <div className="container-iw py-10 lg:py-14">
        <div className="mb-5 flex flex-col items-center gap-1.5 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Testimonials</p>
          <h2 className="font-heading text-xl font-semibold text-ink-dark sm:text-2xl">
            Our customer speaks for us
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Real reviews from verified Cozy Furnitures customers</p>
        </div>
        <div className="mb-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label="Previous reviews"
            disabled={!canPrev}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-dark shadow-hover transition ${
              canPrev ? 'hover:bg-brand hover:text-white' : 'cursor-default opacity-40'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label="More reviews"
            disabled={!canNext}
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink-dark shadow-hover transition ${
              canNext ? 'hover:bg-brand hover:text-white' : 'cursor-default opacity-40'
            }`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={trackRef}
          onScroll={updateArrows}
          role="region"
          aria-label="Customer reviews"
          className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {reviews.map((r) => (
            <figure
              key={r.id}
              className="flex w-[86%] shrink-0 snap-start flex-col rounded-2xl bg-cream-soft p-5 shadow-card sm:w-[380px]"
            >
              <span
                aria-hidden
                className="mb-2 font-heading text-4xl font-extrabold leading-none text-brand"
              >
                &ldquo;
              </span>
              <Stars rating={r.rating} />
              <blockquote className="mt-3 flex-1">
                {r.title && (
                  <p className="text-sm font-semibold text-ink-dark">{r.title}</p>
                )}
                <p className="mt-1 line-clamp-5 text-sm leading-relaxed text-ink">{r.body}</p>
              </blockquote>
              <figcaption className="mt-4 border-t border-cream-border pt-3">
                <span className="text-sm font-semibold text-ink-dark">{r.author}</span>
                {r.product && (
                  <>
                    <span className="mx-1.5 text-ink-light">•</span>
                    <Link
                      href={`/products/${r.product.handle}`}
                      className="text-[13px] font-medium text-brand hover:underline"
                    >
                      {r.product.title}
                    </Link>
                  </>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
