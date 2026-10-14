'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { ProductCard } from '@/components/catalog/ProductCard';
import type { ProductCardData } from '@/lib/queries';

/**
 * Horizontal scroll-snap carousel of product cards. Cards swipe natively on
 * touch devices; circular arrow buttons appear on md+ screens.
 */
export function ProductCarousel({ products, label }: { products: ProductCardData[]; label: string }) {
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
    // re-check when the viewport (and therefore card widths) change
    window.addEventListener('resize', updateArrows);
    return () => window.removeEventListener('resize', updateArrows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length]);

  if (products.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={updateArrows}
        role="region"
        aria-label={label}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div
            key={p.id}
            className="w-[168px] shrink-0 snap-start sm:w-[206px] lg:w-[236px]"
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      {products.length > 3 && (
        <>
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={`Scroll ${label} backward`}
            disabled={!canPrev}
            className={`absolute -left-3 top-[38%] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink-dark shadow-hover transition md:flex ${
              canPrev ? 'hover:bg-brand hover:text-white' : 'pointer-events-none opacity-0'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={`Scroll ${label} forward`}
            disabled={!canNext}
            className={`absolute -right-3 top-[38%] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white text-ink-dark shadow-hover transition md:flex ${
              canNext ? 'hover:bg-brand hover:text-white' : 'pointer-events-none opacity-0'
            }`}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}
