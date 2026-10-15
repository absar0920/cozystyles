'use client';

import { useEffect, useState } from 'react';

export type Slide = { image: string; heading: string; text: string };

/**
 * Live `image-with-text-slideshow` (grid--image-small, image first): synced fade carousels —
 * image pane (flex 1, 550px desktop / 350px mobile) + cream text pane (720px) with page dots.
 * Autoplays every 5s and wraps around, no arrows. Below md the text pane takes the active slide's
 * height (Flickity adaptiveHeight); from md the slides share one grid cell (tallest wins).
 * Live's adaptive height comes out one text line (29px) short of each cell's 65px-padded height, so
 * the mobile bottom padding is 36px.
 */
export function ImageTextSlideshow({ slides, interval = 5000 }: { slides: Slide[]; interval?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), interval);
    return () => window.clearInterval(timer);
  }, [slides.length, interval, index]);

  return (
    <div className="flex flex-wrap overflow-hidden">
      <div className="relative flex h-[350px] w-full grow bg-accent md:h-[550px] md:flex-1">
        {slides.map((slide, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={slide.image}
            src={slide.image}
            alt=""
            loading={i === 0 ? undefined : 'lazy'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </div>
      <div className="relative grid w-full overflow-hidden bg-cream md:w-[720px]">
        {slides.map((slide, i) => (
          <div
            key={slide.heading}
            aria-hidden={i !== index}
            className={`col-start-1 row-start-1 w-full max-w-[700px] px-[25px] pb-[36px] pt-[25px] transition-opacity duration-500 md:px-[45px] md:pb-[65px] md:pt-[45px] lg:p-[70px] ${
              i === index
                ? 'z-[1] opacity-100'
                : 'pointer-events-none opacity-0 max-md:absolute max-md:inset-x-0 max-md:top-0'
            }`}
          >
            <h3 className="mb-5">{slide.heading}</h3>
            <div className="rte">
              <p className="!mb-5">{slide.text}</p>
            </div>
          </div>
        ))}
        <ol className="absolute bottom-[25px] left-[25px] right-[25px] z-[2] m-0 flex list-none p-0 leading-[0] md:bottom-[45px] md:left-[45px] md:right-[45px] lg:bottom-[70px] lg:left-[70px] lg:right-[70px]">
          {slides.map((slide, i) => (
            <li
              key={slide.heading}
              className="sf-dot"
              aria-current={i === index}
              aria-label={`Page dot ${i + 1}`}
              role="button"
              tabIndex={0}
              onClick={() => setIndex(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setIndex(i);
              }}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
