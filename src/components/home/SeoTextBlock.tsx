'use client';

import { Fragment, useState } from 'react';

/**
 * Until "Show more" is pressed the text is cut and "..." appended. Live's theme cuts 500 characters of markup,
 * which ended its copy after 464 characters of text ("...explore, and purcha..."); the same count is used here.
 */
const COLLAPSE_AT = 464;

/** Lines → <br />; a blank line starts a new paragraph. */
function Paragraphs({ text, className }: { text: string; className: string }) {
  return text.split(/\n[ \t]*\n+/).map((para, i) => (
    <p key={i} className={className}>
      {para.split('\n').map((line, j) => (
        <Fragment key={j}>
          {j > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </p>
  ));
}

/**
 * Live `.text-heading` block at the bottom of the home page, with the owner's heading and text (Admin → Settings →
 * Home page; both empty → no block): beige band, centred 40px heading, text cut after 464 characters with "...", and
 * a green underlined "Show more" / "Show less" toggle when there is more. On mobile the empty right column of the
 * live two-column layout still adds 55px under the text (kept in the bottom padding).
 */
export function SeoTextBlock({ heading, text }: { heading: string; text: string }) {
  const [open, setOpen] = useState(false);
  const chars = Array.from(text);
  const long = chars.length > COLLAPSE_AT;
  if (!heading && !text) return null;
  // The collapsed text tightens word spacing by half a pixel on phones: the live cut (with the longer
  // shop name) then keeps live's 10 lines.
  const pClass = `mb-5 text-[14px] font-normal leading-[23.8px] text-accent md:text-[17px] md:leading-[28.9px] ${
    long && !open ? 'max-md:[word-spacing:-0.5px]' : ''
  }`;
  return (
    <section className="bg-[#f5f5e5] pb-[70px] md:pb-[60px]" data-testid="home-text-block">
      <div className="mx-5 max-w-[1400px] pt-[35px] text-center md:pt-20 min-[1440px]:mx-auto">
        {heading && (
          <h4 className="mb-5 text-[30px] font-semibold leading-[28.5px] text-accent md:text-[40px] md:leading-[38px]">{heading}</h4>
        )}
        {text && (
          <div className="readmore__content">
            <Paragraphs text={long && !open ? `${chars.slice(0, COLLAPSE_AT).join('')}...` : text} className={pClass} />
          </div>
        )}
        {long && (
          <div className="leading-[29.75px]">
            <button
              type="button"
              role="switch"
              aria-checked={open}
              onClick={() => setOpen((o) => !o)}
              className="inline-block cursor-pointer border-0 bg-transparent p-0 text-[18px] font-normal leading-[18px] text-leaf underline"
            >
              {open ? 'Show less' : 'Show more'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
