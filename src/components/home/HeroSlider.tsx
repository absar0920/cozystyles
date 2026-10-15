'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export type HeroSlide = {
  id: number;
  title: string;
  href: string | null;
  image: string;
  mobileImage: string | null;
};

const AUTOPLAY_MS = 7000;

/**
 * Live `.main-slideshow`: full-bleed, image-only slides (desktop art 1920:739, mobile art
 * 450:700 below 768px), Flickity fade transition, 7s autoplay that pauses on hover, swipe/drag,
 * and a centred row of white ring dots. No text, overlay or arrows.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const drag = useRef<{ x: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    if (paused || count < 2) return;
    const t = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, paused, count, go]);

  if (count === 0) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (drag.current && Math.abs(e.clientX - drag.current.x) > 8) drag.current.moved = true;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    suppressClick.current = d.moved;
    if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <section
      className="relative w-full select-none overflow-hidden bg-accent"
      aria-roledescription="carousel"
      aria-label="Featured"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="relative aspect-[450/700] w-full touch-pan-y md:aspect-[1920/739]"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        onClickCapture={(e) => {
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        {slides.map((s, i) => {
          const active = i === index;
          const picture = (
            <picture>
              {s.mobileImage && <source media="(max-width: 767px)" srcSet={s.mobileImage} />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.image}
                alt=""
                loading={i === 0 ? 'eager' : 'lazy'}
                fetchPriority={i === 0 ? 'high' : undefined}
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover object-center"
              />
            </picture>
          );
          return (
            <div
              key={s.id}
              className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                active ? 'z-[1] opacity-100' : 'pointer-events-none z-0 opacity-0'
              }`}
              aria-hidden={!active}
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
            >
              {s.href ? (
                <Link href={s.href} className="absolute inset-0 block" aria-label={s.title} tabIndex={active ? 0 : -1}>
                  {picture}
                </Link>
              ) : (
                picture
              )}
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <ol className="absolute bottom-5 left-0 z-[2] m-0 flex w-full list-none justify-center p-0 leading-none md:bottom-[45px]">
          {slides.map((s, i) => (
            <li key={s.id} className="flex">
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={`mx-[3px] block h-2 w-2 cursor-pointer rounded-[6px] border-2 border-white p-0 md:mx-1 md:h-3 md:w-3 ${
                  i === index ? 'bg-white opacity-100' : 'bg-transparent opacity-60'
                }`}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
