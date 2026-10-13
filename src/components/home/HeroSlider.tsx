'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@/components/icons';

export type HeroSlide = {
  id: number;
  title: string;
  subtitle: string;
  ctaLabel: string | null;
  href: string | null;
  image: string;
  mobileImage: string | null;
  textColor: string;
  overlay: number;
};

/**
 * Full-width hero carousel. Web banner is 1200x462 (landscape); the mobile
 * banner is 450x700 (portrait) and is swapped in below the sm breakpoint via
 * a <picture> element. Autoplays every 5s, pauses on hover/focus.
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
      {/* aspect switches between the portrait mobile art and landscape web art */}
      <div className="relative aspect-[450/700] overflow-hidden bg-brand-900 sm:aspect-[1200/462]">
        {slides.map((slide, i) => {
          const active = i === index;
          const dim = Math.min(0.85, Math.max(0, slide.overlay / 100));
          return (
            <div
              key={slide.id}
              aria-hidden={!active}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}: ${slide.title}`}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${active ? 'z-10 opacity-100' : 'z-0 opacity-0'}`}
            >
              <picture>
                {slide.mobileImage && (
                  <source media="(max-width: 639px)" srcSet={slide.mobileImage} />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={slide.image}
                  alt={slide.title || 'Interwood promotion'}
                  width={1200}
                  height={462}
                  draggable={false}
                  className={`h-full w-full object-cover transition-transform duration-[6000ms] ease-out ${
                    active ? 'scale-100' : 'scale-105'
                  }`}
                />
              </picture>

              {/* subtle gradient scrim so text stays legible */}
              <div
                aria-hidden
                className="absolute inset-0 hidden sm:block"
                style={{
                  background: `linear-gradient(90deg, rgba(16,58,58,${dim}) 0%, rgba(16,58,58,${dim * 0.45}) 42%, rgba(16,58,58,0) 72%)`,
                }}
              />
              <div
                aria-hidden
                className="absolute inset-0 sm:hidden"
                style={{
                  background: `linear-gradient(0deg, rgba(16,58,58,${Math.min(0.9, dim + 0.25)}) 0%, rgba(16,58,58,${dim * 0.3}) 45%, rgba(16,58,58,0) 75%)`,
                }}
              />

              {/* copy */}
              <div
                className="absolute inset-0 flex items-end sm:items-center"
                style={{ color: slide.textColor || '#ffffff' }}
              >
                <div className="container-iw">
                  <div
                    className={`max-w-[22rem] pb-16 sm:max-w-xl sm:pb-0 ${
                      active ? 'animate-fadeIn' : 'opacity-0'
                    }`}
                  >
                    {slide.title && (
                      <h2 className="font-heading text-2xl font-bold leading-tight drop-shadow-sm sm:text-3xl lg:text-[2.6rem]">
                        {slide.title}
                      </h2>
                    )}
                    {slide.subtitle && (
                      <p className="mt-2 text-sm font-medium opacity-90 drop-shadow-sm sm:mt-3 sm:text-lg">
                        {slide.subtitle}
                      </p>
                    )}
                    {slide.ctaLabel && (
                      <Link
                        href={slide.href || '/collections/all'}
                        tabIndex={active ? 0 : -1}
                        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-900 shadow-lg shadow-brand-950/20 transition hover:bg-brand hover:text-white sm:mt-6 sm:px-7 sm:py-3 sm:text-[15px]"
                      >
                        {slide.ctaLabel}
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
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
