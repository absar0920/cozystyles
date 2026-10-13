'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/icons';

type GalleryImage = { src: string; alt: string };

/**
 * Product image gallery: main image with hover zoom (fine-pointer devices only),
 * thumbnail strip, prev/next arrows and keyboard navigation.
 */
export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [canHover, setCanHover] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCanHover(window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  }, []);

  const count = images.length;
  const go = useCallback(
    (dir: 1 | -1) => {
      if (count < 2) return;
      setActive((i) => (i + dir + count) % count);
    },
    [count],
  );

  if (count === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-cream-border bg-cream-soft">
        <span className="font-heading text-5xl font-semibold text-cream-border">IW</span>
      </div>
    );
  }

  const current = images[Math.min(active, count - 1)];

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setOrigin({ x, y });
  };

  return (
    <div className="flex flex-col gap-3" data-gallery>
      {/* Main image */}
      <div
        ref={frameRef}
        role="group"
        aria-label={`${title} image gallery`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(-1);
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(1);
          }
        }}
        onMouseEnter={() => canHover && count > 0 && setZoom(true)}
        onMouseLeave={() => setZoom(false)}
        onMouseMove={onMouseMove}
        className="relative aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl border border-cream-border bg-cream-soft outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.src}
          src={current.src}
          alt={current.alt || title}
          width={900}
          height={900}
          draggable={false}
          className="h-full w-full select-none object-cover transition-transform duration-200 ease-out animate-fadeIn"
          style={{
            transform: zoom ? 'scale(1.9)' : 'scale(1)',
            transformOrigin: `${origin.x}% ${origin.y}%`,
          }}
        />

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-cream-border bg-white/90 p-2 text-ink-dark shadow-card transition hover:bg-white hover:text-brand"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-cream-border bg-white/90 p-2 text-ink-dark shadow-card transition hover:bg-white hover:text-brand"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-md bg-ink-dark/70 px-2 py-0.5 text-[11px] font-medium text-white">
              {active + 1} / {count}
            </span>
          </>
        )}

        {canHover && (
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-ink-muted shadow-card">
            Hover to zoom
          </span>
        )}
      </div>

      {/* Thumbnails */}
      {count > 1 && (
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1" role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={img.src + i}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`View image ${i + 1}`}
              onClick={() => {
                setActive(i);
                frameRef.current?.focus();
              }}
              className={`relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-lg border-2 bg-cream-soft transition sm:h-20 sm:w-20 ${
                i === active ? 'border-brand shadow-card' : 'border-cream-border hover:border-brand-300'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.alt || `${title} thumbnail ${i + 1}`}
                loading="lazy"
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
