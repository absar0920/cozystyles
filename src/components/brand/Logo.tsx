/** Preset heights; the width follows the 300:40 ratio (sm → 150px wide, fits the 256px admin sidebar). */
const SIZES = { sm: 'h-5', md: 'h-10', lg: 'h-12' } as const;

/**
 * Cozy Furnitures logo, drawn in the live header logo's slot: a 300×40 box with a ~34×35 green
 * mark at the left and a thin, near-black uppercase wordmark (cap height ≈33px, like the live wordmark) squeezed into x54…291.
 * Scale it by height only — via `size`, or height classes in `className` (header: 40px, mobile 35px).
 * With neither, it renders at `md` (40px tall).
 */
export function Logo({
  variant = 'dark',
  size,
  className = '',
  title = 'Cozy Furnitures',
}: {
  variant?: 'dark' | 'light';
  size?: keyof typeof SIZES;
  /** @deprecated */
  light?: boolean;
  /** @deprecated the live chrome has no tagline */
  withTagline?: boolean;
  className?: string;
  title?: string;
}) {
  const ink = variant === 'light' ? '#ffffff' : '#231f20';
  // A caller sizing via className owns the height; never stack two competing h-* utilities.
  const sizeCls = size ? SIZES[size] : className ? '' : SIZES.md;
  return (
    <svg
      viewBox="0 0 300 40"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={`block w-auto max-w-full shrink-0 select-none ${sizeCls} ${className}`}
    >
      {/* sofa geometry spans x4…44, y8…36.5 of its 48-grid; scaled ×52/48 → ≈43×31 at x3…46, centred in the 40px box */}
      <SofaShapes x={-1} y={-4.3} size={52} />
      <text
        x="54"
        y="37.5"
        textLength="237"
        lengthAdjust="spacingAndGlyphs"
        fill={ink}
        style={{ fontFamily: 'var(--font-poppins-thin), Poppins, sans-serif', fontWeight: 200, fontSize: 51, letterSpacing: 0 }}
      >
        COZY FURNITURES
      </text>
    </svg>
  );
}

const GREEN = { dark: '#178a44', base: '#21b259', light: '#4cc77a', lighter: '#8ddcaa', deep: '#0f6e34' };

/** Sofa mark geometry in a 48×48 grid, placed at (x,y) and scaled to `size`. */
function SofaShapes({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 48})`}>
      <SofaPaths />
    </g>
  );
}

function SofaPaths() {
  return (
    <>
      <rect x="4" y="8" width="6.5" height="6.5" rx="2.6" fill={GREEN.dark} />
      <rect x="37.5" y="8" width="6.5" height="6.5" rx="2.6" fill={GREEN.dark} />
      <path d="M10.5 8h27a4 4 0 0 1 4 4v10h-35V12a4 4 0 0 1 4-4z" fill={GREEN.base} />
      <rect x="6.5" y="14" width="35" height="12" rx="4" fill={GREEN.light} />
      <rect x="4" y="22" width="40" height="12" rx="5" fill={GREEN.base} />
      <rect x="6.5" y="30" width="8" height="6.5" rx="2.5" fill={GREEN.deep} />
      <rect x="33.5" y="30" width="8" height="6.5" rx="2.5" fill={GREEN.deep} />
      <rect x="13" y="24" width="22" height="4" rx="2" fill={GREEN.lighter} />
    </>
  );
}

/** The standalone sofa mark (green brand tones). */
export function SofaGlyph({ className = '', ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden {...props}>
      <SofaPaths />
    </svg>
  );
}
