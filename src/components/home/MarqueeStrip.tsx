/** Live leading padding: 15 × (U+200E LEFT-TO-RIGHT MARK + space) before the text. */
const LEAD = '\u200E '.repeat(15);

/** `messages` once (twice when there is only one); screen readers hear each message once. */
function Group({ messages, hidden }: { messages: string[]; hidden?: boolean }) {
  const items = messages.length === 1 ? [messages[0], messages[0]] : messages;
  return (
    <div className="flex shrink-0" aria-hidden={hidden || undefined}>
      {items.map((m, i) => (
        <div key={i} className="block px-[5vw]" aria-hidden={(!hidden && i >= messages.length) || undefined}>
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
 * Live `.scrolling-text`: yellow strip under the banners with the owner's messages scrolling left
 * (Admin → Settings → Home page, one message per line; no messages → no strip). Two identical groups
 * in one track; the track moves −50% (= one group) every 20s. A single message is shown twice per
 * group, as on live, so the strip stays filled.
 */
export function MarqueeStrip({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <section className="mb-[25px] bg-[#f6e84a] text-black md:mb-10" aria-label="Announcement" data-testid="home-strip">
      <div className="flex items-center overflow-hidden whitespace-nowrap py-[15px] text-[16px] font-medium leading-[28px] md:text-[18px] md:leading-[31.5px]">
        <div className="flex w-max animate-marquee [animation-duration:20s] motion-reduce:animate-none">
          <Group messages={messages} />
          <Group messages={messages} hidden />
        </div>
      </div>
    </section>
  );
}
