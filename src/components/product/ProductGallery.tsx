'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ThemeArrowLeft, ThemeArrowRight } from '@/components/icons';
import { ZoomIcon } from './icons';
import { Lightbox } from './Lightbox';

export type GalleryImage = { src: string; alt: string };

const DEFAULT_RATIO = 700 / 920;
/**
 * Live Flickity (adaptiveHeight) caches every cell's height at init, while the cells still show the
 * lazysizes `_20x_crop_center` placeholder, and never re-measures. So the slider height follows the
 * placeholder's rounded ratio (20×round(20·h/w)) — e.g. 0.75 for a 920×700 image, whose 441px-tall
 * image is then clipped to 435px at 580 wide — and 4:3 until the image is known locally.
 */
const PLACEHOLDER_RATIO = 0.75;
const placeholderRatio = (r: number) => Math.round(20 * r) / 20;
/** Live thumbnails are `_160x` renditions shown at 80px, so their height is round(160·h/w)/2. */
const thumbHeight = (r: number) => Math.round(160 * r) / 2;
/** Live `<scroll-shadow>` around the thumbnail column: white fades up to 60px deep. */
const SHADOW_MAX = 60;

/**
 * Live Habitat product gallery ("thumbnails left"):
 * - ≥1068: 80px vertical thumbnail column (scrolls with white scroll-shadow fades, height = slider,
 *   inset 1px ring on the selected one) + main slider max 580px (placeholder-ratio height, see
 *   PLACEHOLDER_RATIO), 54px circle arrows shown on hover, 40px zoom button top-right.
 * - <1068: full-bleed slider, swipe, page dots under it (bottom border), no thumbnails / arrows.
 * Clicking the image or the zoom button opens the fullscreen lightbox.
 */
export function ProductGallery({
  images,
  index,
  onIndex,
}: {
  images: GalleryImage[];
  index: number;
  onIndex: (i: number) => void;
}) {
  const count = images.length;
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const [zoomOpen, setZoomOpen] = useState(false);
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const viewport = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [shadow, setShadow] = useState({ top: 0, bottom: 0 });
  const updateShadow = useCallback(() => {
    const el = thumbs.current;
    if (!el) return;
    const clamp = (n: number) => Math.min(SHADOW_MAX, Math.max(0, n));
    const next = { top: clamp(el.scrollTop), bottom: clamp(el.scrollHeight - el.offsetHeight - el.scrollTop) };
    setShadow((prev) => (prev.top === next.top && prev.bottom === next.bottom ? prev : next));
  }, []);

  // Images can finish loading before hydration (no onLoad then), so also measure on ref attach.
  const measure = useCallback((i: number, el: HTMLImageElement | null) => {
    if (!el?.complete || !el.naturalWidth) return;
    const r = el.naturalHeight / el.naturalWidth;
    setRatios((prev) => (prev[i] === r ? prev : { ...prev, [i]: r }));
  }, []);

  useEffect(() => {
    updateShadow();
    window.addEventListener('resize', updateShadow);
    return () => window.removeEventListener('resize', updateShadow);
  }, [updateShadow, ratios, images]);

  const go = useCallback((i: number) => onIndex(((i % count) + count) % count), [count, onIndex]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (count < 2) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    moved.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (!moved.current && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      moved.current = true;
      viewport.current?.setPointerCapture(e.pointerId);
    }
    if (moved.current) setDrag(dx);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    setDrag(0);
    if (moved.current && Math.abs(dx) > 40) {
      // live gallery does not wrap past the ends
      if (dx < 0 && index < count - 1) onIndex(index + 1);
      if (dx > 0 && index > 0) onIndex(index - 1);
    }
  };

  if (count === 0) {
    return <div className="w-full bg-cream" style={{ paddingBottom: `${DEFAULT_RATIO * 100}%` }} />;
  }

  const known = ratios[index];
  const ratio = known != null ? placeholderRatio(known) : PLACEHOLDER_RATIO;

  return (
    <div className="lg:flex">
      {/* thumbnails (≥1068) */}
      {count > 1 && (
        <div className="relative hidden w-20 shrink-0 lg:block">
          <div
            ref={thumbs}
            onScroll={updateShadow}
            className="no-scrollbar absolute inset-0 grid auto-rows-max grid-cols-[80px] gap-[10px] overflow-y-auto"
          >
            {images.map((img, i) => (
              <button
                key={`${img.src}-${i}`}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index}
                className="relative block w-20 cursor-pointer p-0 after:pointer-events-none after:absolute after:inset-0 after:opacity-0 after:shadow-[inset_0_0_0_1px_#103a3a] after:transition-opacity after:duration-[250ms] after:content-[''] aria-[current=true]:after:opacity-100"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt=""
                  loading="lazy"
                  className="block h-auto w-20 object-cover"
                  style={ratios[i] != null ? { height: thumbHeight(ratios[i]) } : undefined}
                  ref={(el) => measure(i, el)}
                  onLoad={(e) => measure(i, e.currentTarget)}
                />
              </button>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-[5] bg-no-repeat"
            style={{
              backgroundImage: 'linear-gradient(#fff, rgba(255,255,255,0)), linear-gradient(rgba(255,255,255,0), #fff)',
              backgroundPosition: 'top, bottom',
              backgroundSize: `100% ${shadow.top}px, 100% ${shadow.bottom}px`,
            }}
          />
        </div>
      )}

      {/* main slider */}
      <div className="min-w-0 flex-1 lg:px-[25px]">
        <div className="group/slider relative mx-auto w-full lg:max-w-[580px]">
          <div
            ref={viewport}
            className={`relative w-full touch-pan-y overflow-hidden transition-[padding] duration-[250ms] ease-theme ${count > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{ paddingBottom: `${ratio * 100}%` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              start.current = null;
              setDrag(0);
            }}
          >
            <div
              className={`absolute inset-0 flex items-start ${drag ? '' : 'transition-transform duration-500 ease-theme'}`}
              style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))` }}
            >
              {images.map((img, i) => (
                <div key={`${img.src}-${i}`} className="w-full shrink-0" aria-hidden={i !== index}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.alt}
                    draggable={false}
                    loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                    className="block h-auto w-full select-none"
                    ref={(el) => measure(i, el)}
                    onLoad={(e) => measure(i, e.currentTarget)}
                    onClick={() => {
                      if (!moved.current) setZoomOpen(true);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="Zoom"
            className="absolute right-5 top-5 z-[40] flex h-10 w-10 items-center justify-center rounded-btn border border-formline bg-white text-accent transition-colors duration-[250ms] ease-theme"
          >
            <ZoomIcon className="h-4 w-4" />
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                aria-label="Previous"
                className="absolute left-[13px] top-1/2 z-30 -mt-[27px] hidden h-[54px] w-[54px] items-center justify-center rounded-full border border-accent bg-white text-accent opacity-0 transition-all duration-[250ms] ease-theme hover:bg-accent hover:text-cream focus-visible:opacity-100 group-hover/slider:opacity-100 md:flex lg:-left-[27px]"
              >
                <ThemeArrowLeft />
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                aria-label="Next"
                className="absolute right-[13px] top-1/2 z-30 -mt-[27px] hidden h-[54px] w-[54px] items-center justify-center rounded-full border border-accent bg-white text-accent opacity-0 transition-all duration-[250ms] ease-theme hover:bg-accent hover:text-cream focus-visible:opacity-100 group-hover/slider:opacity-100 md:flex lg:-right-[27px]"
              >
                <ThemeArrowRight />
              </button>
            </>
          )}
        </div>

        {/* page dots (<1068) */}
        {count > 1 && (
          <ol className="m-0 list-none border-b border-line p-[15px] text-center leading-[0] lg:hidden">
            {images.map((img, i) => (
              <li key={`${img.src}-${i}`} className="inline-block">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Page dot ${i + 1}`}
                  className={`mx-[3px] inline-block h-2 w-2 cursor-pointer rounded-[6px] border-2 border-accent p-0 md:mx-1 md:h-3 md:w-3 ${i === index ? 'bg-accent opacity-100' : 'opacity-60 hover:opacity-100'}`}
                />
              </li>
            ))}
          </ol>
        )}
      </div>

      {zoomOpen && <Lightbox images={images} index={index} onIndex={go} onClose={() => setZoomOpen(false)} />}
    </div>
  );
}
