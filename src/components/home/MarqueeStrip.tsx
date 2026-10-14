import type { SVGProps } from 'react';
import { HeartIcon } from '@/components/icons';

/** Brand-toned scrolling promo strip shown directly under the hero slider. */

const MESSAGE = 'FREE Nationwide Delivery!';
const REPEATS = 10;

/** Inline sofa glyph matching the stroke style of @/components/icons. */
const SofaIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
    <path d="M2 16a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v1H6v-1a2 2 0 0 0-4 0Z" />
    <path d="M4 18v2M20 18v2" />
  </svg>
);

function MarqueeCopy({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <span aria-hidden={ariaHidden} className="flex shrink-0 items-center">
      {Array.from({ length: REPEATS }).map((_, i) => (
        <span
          key={i}
          className="flex items-center whitespace-nowrap text-[13px] font-bold uppercase tracking-wider text-brand-800"
        >
          {MESSAGE}
          <span aria-hidden className="mx-4 flex items-center text-brand-400">
            {i % 2 === 0 ? <SofaIcon className="h-3.5 w-3.5" /> : <HeartIcon className="h-3.5 w-3.5" />}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Infinite horizontal marquee. The animated track holds two identical copies
 * and slides by -50%, so the loop is seamless. Screen readers get the
 * message once via the sr-only paragraph.
 */
export function MarqueeStrip() {
  return (
    <div className="overflow-hidden bg-brand-50 py-2.5" role="presentation">
      <p className="sr-only">{MESSAGE}</p>
      <div className="flex w-max animate-marquee">
        <MarqueeCopy />
        <MarqueeCopy ariaHidden />
      </div>
    </div>
  );
}
