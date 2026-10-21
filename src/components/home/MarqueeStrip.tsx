/** Yellow scrolling promo strip shown directly under the hero slider. */

const MESSAGE = 'FREE Nationwide Delivery!';
const REPEATS = 10;

function MarqueeCopy({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <span aria-hidden={ariaHidden} className="flex shrink-0 items-center">
      {Array.from({ length: REPEATS }).map((_, i) => (
        <span
          key={i}
          className="flex items-center whitespace-nowrap text-[13px] font-bold uppercase tracking-wider text-ink-dark"
        >
          {MESSAGE}
          <span aria-hidden className="mx-4 opacity-60">
            &bull;
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
    <div className="overflow-hidden bg-[#f6e84a] py-2.5" role="presentation">
      <p className="sr-only">{MESSAGE}</p>
      <div className="flex w-max animate-marquee">
        <MarqueeCopy />
        <MarqueeCopy ariaHidden />
      </div>
    </div>
  );
}
