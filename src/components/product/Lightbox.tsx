'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ThemeArrowLeft, ThemeArrowRight } from '@/components/icons';

type Img = { src: string; alt: string };

/** Live `.pswp__button`: white circle, 1px accent ring; 36px (15px inset) → 54px (27px inset) ≥768. */
const BUTTON =
  'absolute z-30 flex h-9 w-9 items-center justify-center rounded-full border border-accent bg-white text-accent hover:bg-accent hover:text-cream md:h-[54px] md:w-[54px]';

/**
 * Fullscreen image viewer (live: PhotoSwipe v4 with the Habitat skin) — opaque white backdrop,
 * no counter, round bordered close + prev/next buttons, image at most its natural size inside a
 * 50px vertical gap, keyboard nav. Clicking the backdrop (or an image shown at natural size) closes.
 */
export function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: Img[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const count = images.length;
  const go = (d: number) => onIndex((index + d + count) % count);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count);
      if (e.key === 'ArrowRight') onIndex((index + 1) % count);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [index, count, onIndex, onClose]);

  const img = images[index];
  if (!img) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Product images"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close (Esc)"
        title="Close (Esc)"
        className={`${BUTTON} right-[15px] top-[15px] md:right-[27px] md:top-[27px]`}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M13 1L1 13M13 13L1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={img.src}
        alt={img.alt}
        className="max-h-[calc(100vh-100px)] max-w-full object-contain"
        onClick={(e) => {
          // PhotoSwipe closes on a click on a non-zoomable (natural-size) image
          const el = e.currentTarget;
          if (el.width < el.naturalWidth) e.stopPropagation();
        }}
      />
      {count > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous (arrow left)"
            title="Previous (arrow left)"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
            className={`${BUTTON} left-[15px] top-1/2 -mt-[18px] md:left-[27px] md:-mt-[27px]`}
          >
            <ThemeArrowLeft />
          </button>
          <button
            type="button"
            aria-label="Next (arrow right)"
            title="Next (arrow right)"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
            className={`${BUTTON} right-[15px] top-1/2 -mt-[18px] md:right-[27px] md:-mt-[27px]`}
          >
            <ThemeArrowRight />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
