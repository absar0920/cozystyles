'use client';

import { useEffect, useRef, useState } from 'react';
import { ThemeArrowLeft, ThemeArrowRight } from '@/components/icons';
import { ProductCard, type ProductCardExtras } from '@/components/catalog/ProductCard';
import type { ProductCardData } from '@/lib/queries';
import { useDragTrack } from './useDragTrack';

export type CarouselProduct = ProductCardData & ProductCardExtras;

/** Live breakpoint: 4 cards from 1068px ("large-3"), 2 cards below. */
const visibleFor = (w: number) => (w >= 1068 ? 4 : 2);
const IMAGE_RATIO = 700 / 920;

/**
 * Live featured-collection Flickity carousel: 4-up (2-up below 1068px) product cards with
 * 30px gutters (15px mobile), drag/swipe, one card per arrow click, no wrap. The 54px circle
 * arrows straddle the container edge, centred on the image, and fade in on hover (desktop only).
 */
export function ProductCarousel({ products, label }: { products: CarouselProduct[]; label: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(4);
  const [imageH, setImageH] = useState<number | null>(null);
  const [index, setIndex] = useState(0);
  const maxIndex = Math.max(0, products.length - visible);
  const clamp = (i: number) => Math.min(maxIndex, Math.max(0, i));

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const v = visibleFor(window.innerWidth);
      setVisible(v);
      const cell = el.clientWidth / v;
      const gutter = window.innerWidth >= 768 ? 30 : 15;
      setImageH((cell - gutter) * IMAGE_RATIO);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => setIndex((i) => Math.min(i, maxIndex)), [maxIndex]);

  const cellPx = () => (viewportRef.current?.clientWidth ?? 0) / visible;
  const { offset, dragging, handlers } = useDragTrack((dx) => {
    const cell = cellPx();
    if (!cell) return;
    const steps = Math.round(-dx / cell) || (dx < 0 ? 1 : -1);
    setIndex((i) => clamp(i + steps));
  });

  if (products.length === 0) return null;

  const arrowTop = imageH != null ? imageH / 2 - 27 : undefined;

  return (
    <div className="group/carousel relative" role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={viewportRef} className="-mx-[7.5px] overflow-hidden md:-mx-[15px]">
        <div
          className={`flex touch-pan-y select-none ${dragging ? '' : 'transition-transform duration-500 ease-theme'}`}
          style={{ transform: `translateX(calc(${(-index * 100) / visible}% + ${offset}px))` }}
          {...handlers}
        >
          {products.map((p, i) => (
            <div
              key={p.id}
              className="w-1/2 shrink-0 px-[7.5px] md:px-[15px] lg:w-1/4"
              aria-hidden={i < index || i >= index + visible}
            >
              <ProductCard product={p} priority={i < 4} />
            </div>
          ))}
        </div>
      </div>

      {products.length > visible && (
        <>
          <ArrowButton side="prev" top={arrowTop} onClick={() => setIndex((i) => clamp(i - 1))} label={label} />
          <ArrowButton side="next" top={arrowTop} onClick={() => setIndex((i) => clamp(i + 1))} label={label} />
        </>
      )}
    </div>
  );
}

function ArrowButton({
  side,
  top,
  onClick,
  label,
}: {
  side: 'prev' | 'next';
  top: number | undefined;
  onClick: () => void;
  label: string;
}) {
  const Icon = side === 'prev' ? ThemeArrowLeft : ThemeArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${side === 'prev' ? 'Previous' : 'Next'} — ${label}`}
      style={{ top }}
      className={`absolute z-10 hidden h-[54px] w-[54px] cursor-pointer items-center justify-center rounded-full border border-accent bg-white text-accent opacity-0 transition-[opacity,background-color,color] duration-[250ms] ease-theme hover:bg-accent hover:text-white focus-visible:opacity-100 group-hover/carousel:opacity-100 [@media(hover:hover)]:md:flex ${
        side === 'prev' ? '-left-[28px]' : '-right-[28px]'
      } ${top == null ? 'top-[30%]' : ''}`}
    >
      <Icon />
    </button>
  );
}
