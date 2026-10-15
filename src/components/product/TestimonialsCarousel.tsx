'use client';

import { useEffect, useRef, useState } from 'react';

type Item = { quote: string; author: string };

/**
 * Live `.testimonials` (Flickity, center aligned, wrap-around, autoplay 5s): dark teal band,
 * centred heading, cells 100% / 66% / 50% wide, neighbours at 20% opacity, page dots.
 */
export function TestimonialsCarousel({
  heading,
  subheading,
  size,
  items,
}: {
  heading: string;
  subheading: string | null;
  size: string;
  items: Item[];
}) {
  const n = items.length;
  // Rendered three times so neighbours exist on both sides at every position (wrap-around).
  const [pos, setPos] = useState(n);
  const [animate, setAnimate] = useState(true);
  const [paused, setPaused] = useState(false);
  const drag = useRef<{ x: number; id: number } | null>(null);
  const [dx, setDx] = useState(0);
  const current = ((pos % n) + n) % n;

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => {
      setAnimate(true);
      setPos((p) => p + 1);
    }, 5000);
    return () => clearTimeout(t);
  }, [pos, paused, n]);

  // after sliding into a clone, jump back to the middle copy without animation
  const onTransitionEnd = () => {
    if (pos < n || pos >= 2 * n) {
      setAnimate(false);
      setPos(current + n);
    }
  };
  useEffect(() => {
    if (!animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [animate]);

  if (n === 0) return null;
  const cells = [...items, ...items, ...items];
  const textSize = size === 'text-medium' ? 'md:text-[34px]' : size === 'text-large' ? 'md:text-[40px]' : 'md:text-[24px]';

  return (
    <div
      className="overflow-hidden bg-accent py-10 text-center text-cream md:py-[60px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto mb-[25px] max-w-[730px] md:mb-10 px-[15px] md:px-10">
        {subheading && (
          <p className="mb-5 text-[14px] font-medium uppercase leading-none tracking-[0.1em] opacity-60">{subheading}</p>
        )}
        <h2 className="text-[34px] font-semibold leading-[42px] text-cream md:text-[36px] md:leading-[44px] lg:text-[40px] lg:leading-[48px]">{heading}</h2>
      </div>

      <div
        className="relative cursor-grab touch-pan-y select-none active:cursor-grabbing"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, id: e.pointerId };
          setPaused(true);
        }}
        onPointerMove={(e) => {
          if (drag.current?.id === e.pointerId) setDx(e.clientX - drag.current.x);
        }}
        onPointerUp={(e) => {
          const d = drag.current ? e.clientX - drag.current.x : 0;
          drag.current = null;
          setDx(0);
          setPaused(false);
          if (Math.abs(d) > 40) {
            setAnimate(true);
            setPos((p) => p + (d < 0 ? 1 : -1));
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDx(0);
          setPaused(false);
        }}
      >
        <div
          className={`flex ${animate && !dx ? 'transition-transform duration-500 ease-theme' : ''} [--cell:100%] md:[--cell:66%] lg:[--cell:50%]`}
          style={{ transform: `translateX(calc(50% - var(--cell) / 2 - ${pos} * var(--cell) + ${dx}px))` }}
          onTransitionEnd={onTransitionEnd}
        >
          {cells.map((t, i) => (
            <div
              key={i}
              aria-hidden={i !== pos}
              className={`w-[var(--cell)] shrink-0 px-[12.5px] transition-opacity duration-[250ms] ease-theme md:px-[30px] ${i === pos ? 'opacity-100' : 'opacity-20'}`}
            >
              <div className={`mx-auto flex max-w-[700px] flex-col text-[20px] ${textSize}`}>
                {/* live empty .star-rating: 0.8em tall */}
                <div className="mb-5 h-[0.8em] leading-none" />
                <p className="mb-5 leading-[1.3]">{t.quote}</p>
                <div className="text-[14px] font-semibold uppercase leading-none tracking-[0.2em]">{t.author}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {n > 1 && (
        <ol className="m-0 mt-[35px] list-none px-[15px] pt-[15px] leading-[0]">
          {items.map((_, i) => (
            <li key={i} className="inline-block">
              <button
                type="button"
                aria-label={`Page dot ${i + 1}`}
                onClick={() => {
                  setAnimate(true);
                  setPos(n + i);
                }}
                className={`mx-[3px] inline-block h-2 w-2 cursor-pointer rounded-[6px] border-2 border-cream p-0 md:mx-1 md:h-3 md:w-3 ${i === current ? 'bg-cream opacity-100' : 'opacity-60 hover:opacity-100'}`}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
