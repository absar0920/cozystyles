'use client';

import type { SectionKind } from '@/lib/product-layout-sections';

/** "You may also like" and "Customer reviews": nothing to fill in (SPEC §3.7). */
export function AutomaticEditor({ kind }: { kind: SectionKind }) {
  return (
    <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-600">
      {kind === 'reviews'
        ? "Shows the product's customer reviews and the Write a review button. There is nothing to fill in: you can move it, hide it or delete it."
        : 'Filled in automatically: 4 products similar to the one being viewed. There is nothing to fill in: you can move it, hide it or delete it.'}
    </p>
  );
}

/** A tiny drawing of each section kind (section rows and the "Add section" sheet). */
export function KindDiagram({ kind, className = 'h-8 w-12' }: { kind: SectionKind; className?: string }) {
  const box = 'fill-gray-200';
  const dark = 'fill-gray-400';
  const line = 'fill-gray-300';
  const body = (() => {
    switch (kind) {
      case 'overlay':
        return (
          <>
            <rect x="0" y="0" width="48" height="32" rx="3" className={dark} />
            <rect x="14" y="11" width="20" height="3" rx="1" className="fill-white" />
            <rect x="17" y="17" width="14" height="2" rx="1" className="fill-white/80" />
          </>
        );
      case 'imageText':
        return (
          <>
            <rect x="0" y="4" width="22" height="24" rx="2" className={dark} />
            <rect x="26" y="9" width="18" height="3" rx="1" className={line} />
            <rect x="26" y="15" width="20" height="2" rx="1" className={box} />
            <rect x="26" y="19" width="16" height="2" rx="1" className={box} />
          </>
        );
      case 'icons':
        return (
          <>
            <rect x="0" y="6" width="48" height="20" rx="2" className="fill-amber-50" />
            {[4, 16, 28, 40].map((x) => (
              <circle key={x} cx={x + 2} cy="16" r="3" className={dark} />
            ))}
          </>
        );
      case 'testimonials':
        return (
          <>
            <rect x="0" y="4" width="48" height="24" rx="2" className="fill-gray-700" />
            <rect x="10" y="12" width="28" height="2" rx="1" className="fill-white/80" />
            <rect x="14" y="17" width="20" height="2" rx="1" className="fill-white/60" />
          </>
        );
      case 'slideshow':
        return (
          <>
            <rect x="0" y="4" width="48" height="20" rx="2" className={dark} />
            <circle cx="20" cy="28" r="1.5" className={dark} />
            <circle cx="24" cy="28" r="1.5" className={line} />
            <circle cx="28" cy="28" r="1.5" className={line} />
          </>
        );
      case 'featuredCollection':
      case 'recommendations':
        return (
          <>
            <rect x="14" y="2" width="20" height="3" rx="1" className={line} />
            {[0, 13, 26, 39].map((x) => (
              <g key={x}>
                <rect x={x} y="9" width="9" height="13" rx="1.5" className={kind === 'recommendations' ? box : dark} />
                <rect x={x} y="25" width="9" height="2" rx="1" className={box} />
              </g>
            ))}
          </>
        );
      case 'reviews':
        return (
          <>
            {[0, 7, 14, 21, 28].map((x) => (
              <path key={x} d={`M${x + 3} 4l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z`} className="fill-amber-400" />
            ))}
            <rect x="0" y="16" width="40" height="2" rx="1" className={box} />
            <rect x="0" y="21" width="32" height="2" rx="1" className={box} />
            <rect x="0" y="26" width="36" height="2" rx="1" className={box} />
          </>
        );
    }
  })();
  return (
    <svg viewBox="0 0 48 32" className={className} aria-hidden>
      {body}
    </svg>
  );
}
