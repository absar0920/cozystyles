'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@/components/icons';

export type HeroSlide = {
  id: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string | null;
  href: string | null;
  image: string | null;
};

/**
 * Typographic split hero. The legacy banner artwork has the old brand's logo
 * baked into it, so each slide is rebuilt as copy over a brand gradient (left)
 * plus a photo resolved from the banner's target collection (right, stacked
 * below the copy on mobile). Autoplays every 5s, pauses on hover/focus;
 * slides without an image render as a full-bleed gradient panel.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (i: number) => {
      if (count === 0) return;
      setIndex(((i % count) + count) % count);
    },
    [count]
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    if (paused || count <= 1) return;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % count), 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, count]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* the gradient lives on the frame so crossfading slides never mismatch */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
        {slides.map((slide, i) => {
          const active = i === index;
          return (
            <div
              key={slide.id}
              aria-hidden={!active}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${slide.title}`}
              className={`transition-opacity duration-700 ease-out ${
                active
                  ? 'relative z-10 opacity-100'
                  : 'pointer-events-none absolute inset-0 z-0 opacity-0'
              }`}
            >
              <div
                className={`container-iw grid gap-6 py-8 sm:py-10 lg:items-stretch lg:gap-10 lg:py-12 ${
                  slide.image ? 'lg:min-h-[540px] lg:grid-cols-2' : 'lg:min-h-[440px]'
                }`}
              >
                {/* copy panel */}
                <div
                  className={`flex flex-col justify-center ${
                    active ? 'animate-fadeIn' : 'opacity-0'
                  }`}
                >
                  {slide.eyebrow && (
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-200">
                      {slide.eyebrow}
                    </p>
                  )}
                  {slide.title && (
                    <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-[2.9rem]">
                      {slide.title}
                    </h2>
                  )}
                  {slide.subtitle && (
                    <p className="mt-3 max-w-md text-sm font-medium text-white/80 sm:text-base lg:text-lg">
                      {slide.subtitle}
                    </p>
                  )}
                  {slide.ctaLabel && (
                    <Link
                      href={slide.href || '/collections/all'}
                      tabIndex={active ? 0 : -1}
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-900 shadow-lg shadow-brand-950/25 transition hover:bg-cream sm:px-7 sm:text-[15px]"
                    >
                      {slide.ctaLabel}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  )}
                </div>

                {/* image panel — decorative art; the slide label carries the copy */}
                {slide.image && (
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-brand-800 sm:aspect-[16/10] lg:aspect-auto lg:min-h-[380px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.image}
                      alt=""
                      draggable={false}
                      className={`absolute inset-0 h-full w-full object-cover transition-transform duration-[6000ms] ease-out ${
                        active ? 'scale-100' : 'scale-105'
                      }`}
                    />
                    {/* soften the photo edge against the gradient */}
                    <span
                      aria-hidden
                      className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/15"
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* arrows */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous slide"
              className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm transition hover:bg-white hover:text-brand-900 sm:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next slide"
              className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/25 text-white backdrop-blur-sm transition hover:bg-white hover:text-brand-900 sm:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* dots */}
        {count > 1 && (
          <div className="absolute bottom-3 left-0 right-0 z-20 flex items-center justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? 'w-7 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
