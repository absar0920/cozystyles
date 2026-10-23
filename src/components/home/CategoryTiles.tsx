'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { useDragTrack } from './useDragTrack';
import { useWrapPosition } from './useWrapPosition';

export type CategoryTile = { handle: string; title: string; image: string | null };

/** One tile: the collection's photo (5:4, darkened 15%, zooms on hover) with its title below. */
function Tile({ c, focusable = true }: { c: CategoryTile; focusable?: boolean }) {
  return (
    <Link href={`/collections/${c.handle}`} className="group/tile block text-accent" tabIndex={focusable ? 0 : -1} draggable={false}>
      <div className="relative mb-[10px] block overflow-hidden pb-[80%]">
        {c.image ? (
          // Live serves Shopify `_crop_center` square renditions, then covers the 5:4 box:
          // a centred square, object-cover'd, reproduces that framing.
          <span className="absolute left-0 top-1/2 block aspect-square w-full -translate-y-1/2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.image}
              alt={c.title}
              loading="lazy"
              draggable={false}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-theme group-hover/tile:scale-105"
            />
          </span>
        ) : (
          <span className="absolute inset-0 bg-cream" />
        )}
        <span className="absolute inset-0 bg-black/15" aria-hidden />
      </div>
      <h2 className="m-0 pb-[5px] text-left text-[14.4px] font-normal leading-[14.4px] text-accent">{c.title}</h2>
    </Link>
  );
}

/**
 * Live "Shop by Category" (`.list-collections`): wrap-around Flickity of 5:4 collection tiles,
 * 3 per view from 768px (one tile plus a peek on mobile), always-on 15% black overlay, image
 * zooms to 1.05 on hover, title below. No arrows; the page dots sit in a narrow column to the
 * right of the slider, so they stack vertically (a live quirk, kept).
 * With 3 tiles or fewer there is nothing to wrap around (the copies would show a tile twice): each tile shows
 * once, side by side and centred from 768px, in a swipeable row on phones.
 */
export function CategoryTiles({ collections }: { collections: CategoryTile[] }) {
  const n = collections.length;
  const viewportRef = useRef<HTMLDivElement>(null);
  const { pos, animate, current, move, goTo, onTransitionEnd } = useWrapPosition(n);
  const { offset, dragging, handlers } = useDragTrack((dx) => {
    const first = viewportRef.current?.querySelector<HTMLElement>('[data-cell]');
    const cell = first?.offsetWidth ?? 0;
    if (!cell) return;
    move(Math.round(-dx / cell) || (dx < 0 ? 1 : -1));
  });

  if (n === 0) return null;
  if (n <= 3) {
    return (
      <div
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] md:justify-center md:overflow-visible"
        role="region"
        aria-label="Shop by Category"
      >
        {collections.map((c) => (
          <div key={c.handle} className="w-[92%] shrink-0 snap-start px-[7.5px] md:w-1/3 md:px-[15px]">
            <Tile c={c} />
          </div>
        ))}
      </div>
    );
  }
  const cells = [...collections, ...collections, ...collections];

  return (
    <div className="relative">
      <div ref={viewportRef} className="overflow-hidden" role="region" aria-roledescription="carousel" aria-label="Shop by Category">
        <div
          className={`flex touch-pan-y select-none [--cell:92%] md:[--cell:33.3333%] ${animate && !dragging ? 'transition-transform duration-500 ease-theme' : ''}`}
          style={{ transform: `translateX(calc(${-pos} * var(--cell) + ${offset}px))` }}
          onTransitionEnd={onTransitionEnd}
          {...handlers}
        >
          {cells.map((c, i) => {
            const inMiddle = i >= n && i < 2 * n;
            return (
              <div
                key={`${c.handle}-${i}`}
                data-cell
                className="w-[var(--cell)] shrink-0 px-[7.5px] md:px-[15px]"
                aria-hidden={!inMiddle || undefined}
              >
                <Tile c={c} focusable={inMiddle} />
              </div>
            );
          })}
        </div>
      </div>

      <ol className="absolute left-full top-0 m-0 hidden w-[50px] list-none flex-col items-center p-0 pt-10 md:flex" aria-label="Category slides">
        {collections.map((c, i) => (
          <li key={c.handle} className="flex">
            <button
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to ${c.title}`}
              aria-current={i === current}
              className={`block h-3 w-3 cursor-pointer rounded-[6px] border-2 border-accent p-0 ${
                i === current ? 'bg-accent' : 'bg-transparent opacity-60'
              }`}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
