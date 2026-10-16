'use client';

import { useEffect, useState } from 'react';
import { useDragTrack } from '@/components/home/useDragTrack';
import type { Slide } from '@/lib/product-layout-sections';

/**
 * "Wide photo slideshow" with two or more slides (one slide renders the static live markup, see TemplateSections).
 * Every slide uses the FIRST slide's shape (computer: its desktopRatio; phone: its mobileRatio ?? desktopRatio) with
 * object-cover, so the page never jumps between slides. Swipe/drag, dots, autoplay 5 s paused on hover.
 */
export function PdpSlideshow({ slides }: { slides: Slide[] }) {
  const n = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = (i: number) => setIndex(((i % n) + n) % n);
  const { offset, dragging, handlers } = useDragTrack((dx) => {
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
  });

  useEffect(() => {
    if (paused || n < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % n), 5000);
    return () => clearTimeout(t);
  }, [index, paused, n]);

  const first = slides[0];
  const desktopAspect = `${1 / first.desktopRatio}`;
  const mobileAspect = `${1 / (first.mobileRatio ?? first.desktopRatio)}`;

  return (
    <div className="mb-[25px] mt-[30px] md:mb-10" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative cursor-grab touch-pan-y select-none overflow-hidden active:cursor-grabbing" {...handlers}>
        <div
          className={`flex ${dragging ? '' : 'transition-transform duration-500 ease-theme'}`}
          style={{ transform: `translateX(calc(${-index * 100}% + ${offset}px))` }}
        >
          {slides.map((s, i) => (
            <div key={i} className="w-full shrink-0" aria-hidden={i !== index}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.desktop} alt="" loading="lazy" draggable={false} className="hidden h-auto w-full object-cover md:block" style={{ aspectRatio: desktopAspect }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.mobile ?? s.desktop} alt="" loading="lazy" draggable={false} className="block h-auto w-full object-cover md:hidden" style={{ aspectRatio: mobileAspect }} />
            </div>
          ))}
        </div>
      </div>
      <ol className="m-0 mt-[15px] list-none text-center leading-[0]">
        {slides.map((_, i) => (
          <li key={i} className="inline-block">
            <button
              type="button"
              aria-label={`Show photo ${i + 1}`}
              onClick={() => go(i)}
              className={`mx-[3px] inline-block h-2 w-2 cursor-pointer rounded-[6px] border-2 border-accent p-0 md:mx-1 md:h-3 md:w-3 ${i === index ? 'bg-accent opacity-100' : 'opacity-60 hover:opacity-100'}`}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
