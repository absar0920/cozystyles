/** Live leading padding: 15 × (U+200E LEFT-TO-RIGHT MARK + space) before the text. */
const LEAD = '\u200E '.repeat(15);

const MESSAGES = ['FREE Nationwide Delivery!', 'FREE Nationwide Delivery!'];

function Group({ hidden }: { hidden?: boolean }) {
  return (
    <div className="flex shrink-0" aria-hidden={hidden || undefined}>
      {MESSAGES.map((m, i) => (
        <div key={i} className="block px-[5vw]">
          <span className="inline-flex items-center text-accent">
            {LEAD}
            {m}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Live `.scrolling-text`: yellow strip, "FREE Nationwide Delivery!" scrolling left.
 * Two identical groups in one track; the track moves −50% (= one group) every 20s.
 */
export function MarqueeStrip() {
  return (
    <section className="mb-[25px] bg-[#f6e84a] text-black md:mb-10" aria-label="Announcement">
      <div className="flex items-center overflow-hidden whitespace-nowrap py-[15px] text-[16px] font-medium leading-[28px] md:text-[18px] md:leading-[31.5px]">
        <div className="flex w-max animate-marquee [animation-duration:20s] motion-reduce:animate-none">
          <Group />
          <Group hidden />
        </div>
      </div>
    </section>
  );
}
