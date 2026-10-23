import localFont from 'next/font/local';
import { ProductCard } from '@/components/catalog/ProductCard';
import type { CatalogCard } from '@/components/catalog/catalog-data';
import { isExternalHref, normalizeHref, validateHref } from '@/lib/links';
import { Lines } from './Lines';
import { PdpSlideshow } from './PdpSlideshow';
import { pdpIcon } from './pdp-icons';
import { TestimonialsCarousel } from './TestimonialsCarousel';
import type { IconsSection, ImageTextSection, OverlaySection, PdpSection, SlideshowSection } from './pdp-data';

/** Coalesce template headings use Barlow Condensed (live section style override). */
const barlow = localFont({
  src: [
    { path: '../../fonts/barlow-condensed-100-latin.woff2', weight: '100', style: 'normal' },
    { path: '../../fonts/barlow-condensed-600-latin.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
});

/**
 * Live heading scale for `.h2`–`.h4` (font-size/line-height <768 / ≥768 / ≥1068), applied as
 * utilities because Tailwind preflight resets bare h-tags above the `:where()` theme rules.
 */
export const HEADING: Record<string, string> = {
  h2: 'font-semibold text-[40px] leading-[48px] md:text-[46px] md:leading-[54px] lg:text-[54px] lg:leading-[62px]',
  h3: 'font-semibold text-[34px] leading-[42px] md:text-[36px] md:leading-[44px] lg:text-[40px] lg:leading-[48px]',
  h4: 'font-semibold text-[28px] leading-[36px] md:text-[30px] md:leading-[38px]',
};

/** Live `image-with-text-overlay`: full-bleed 500/650px band, cover image, centred white copy (max 600). */
export function ImageWithTextOverlay({ s }: { s: OverlaySection }) {
  return (
    <div className="relative mt-[30px] flex min-h-[500px] w-full overflow-hidden bg-accent py-10 text-center text-white md:min-h-[650px] md:py-20">
      <div className="pointer-events-none absolute inset-0 z-0 after:absolute after:inset-0 after:z-[11] after:bg-black/[0.05] after:content-['']">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="relative z-[5] mx-auto flex w-full max-w-[1360px] items-center justify-center px-[12.5px] md:px-10">
        <div className="max-w-[600px]">
          {s.subheading && (
            <p className="mb-5 text-[14px] font-medium uppercase leading-[1.7] tracking-[0.1em] opacity-60">{s.subheading}</p>
          )}
          <h3 className={`${HEADING[s.headingClass] ?? HEADING.h3} mb-5 text-white [overflow-wrap:anywhere]`}>
            <Lines text={s.heading} />
          </h3>
          <div className="[&_a]:underline [&_a]:underline-offset-[3px] [&_p+p]:mt-[17px] text-[17px] leading-[1.7] text-white [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: s.html }} />
        </div>
      </div>
    </div>
  );
}

/**
 * Live `image-with-text` (grid--image-medium 46% / grid--image-large 56%, text padding 25/45/70).
 * The live section wrapper is a flex row, so the 30px/40px block margins never collapse with the
 * neighbouring sections — `flow-root` reproduces that.
 */
export function ImageWithText({ s }: { s: ImageTextSection }) {
  const imageWidth = s.size === 'large' ? 'md:w-[56%]' : 'md:w-[46%]';
  const hasHeading = !!(s.headingThin ? s.headingThin.join('') : s.heading);
  // Checked again at render: an invalid link becomes "#"; "" (no link) renders as "#" too.
  const rawHref = s.button ? normalizeHref(s.button.href) : '';
  const href = rawHref && !validateHref(rawHref) ? rawHref : '#';
  const external = isExternalHref(href);
  return (
    <div className="mx-auto flow-root max-w-[1360px] px-[12.5px] md:px-10">
      <div
        className={`mt-[30px] flex flex-wrap items-center bg-white md:flex-nowrap ${s.imageFirst ? '' : 'md:flex-row-reverse'} ${s.disableBottom ? '' : 'mb-[25px] md:mb-10'} ${s.center ? 'text-center' : 'text-left'}`}
      >
        <div className={`w-full shrink-0 grow-0 ${imageWidth}`}>
          <div className="relative w-full overflow-hidden" style={{ paddingBottom: `${s.ratio}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
        <div className={`w-full grow p-[25px] md:p-[45px] lg:p-[70px] ${imageWidth}`}>
          {hasHeading && (
            <h3 className={`${HEADING[s.headingClass] ?? HEADING.h3} mb-5 text-accent [overflow-wrap:anywhere] ${s.condensed ? barlow.className : ''}`}>
              {s.headingThin ? (
                <>
                  <span className="font-thin">{s.headingThin[0]}</span>
                  {s.headingThin[1]}
                </>
              ) : (
                <Lines text={s.heading ?? ''} />
              )}
            </h3>
          )}
          <div className="[&_a]:underline [&_a]:underline-offset-[3px] [&_p+p]:mt-[17px] text-[17px] leading-[1.7] text-accent [overflow-wrap:anywhere]" dangerouslySetInnerHTML={{ __html: s.html }} />
          {s.button && (
            // live: an inline link on its own 17px/29.75px line right after the text
            <a
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener' } : {})}
              className="text-button mr-[15px] inline leading-[26.25px]"
            >
              {s.button.label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** Live `text-with-icons` trust strip: cream band, 4 × (64px icon, 20px h6, 15px text); swipe row on mobile. */
export function TextWithIcons({ s }: { s: IconsSection }) {
  return (
    <div className="bg-cream py-[30px] text-center">
      <div className="no-scrollbar mx-auto grid max-w-[1360px] snap-x snap-mandatory auto-cols-[300px] grid-flow-col justify-start gap-x-5 gap-y-10 overflow-x-auto px-[12.5px] md:grid-flow-row md:grid-cols-[repeat(2,minmax(200px,300px))] md:justify-center md:overflow-visible md:px-10 lg:grid-cols-[repeat(4,minmax(200px,300px))]">
        {s.blocks.map((b, i) => {
          const Icon = pdpIcon(b.icon);
          return (
            <div key={i} className="flex snap-center flex-col items-center">
              <div className="mb-[30px] h-16 w-16 shrink-0 text-accent">
                <Icon className="h-auto w-full" />
              </div>
              <div className="text-[15px]">
                <h6 className="mb-[14px] text-[20px] font-semibold leading-none text-accent [overflow-wrap:anywhere]">{b.title}</h6>
                <p className="mb-0 text-[15px] leading-[1.7] [overflow-wrap:anywhere]">
                  <Lines text={b.text} />
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Live single-slide `slideshow` (Coalesce templates): banner adapts to the image, separate mobile art (without one,
 * phones show the computer photo). Two or more slides → the `PdpSlideshow` carousel.
 */
export function Slideshow({ s }: { s: SlideshowSection }) {
  if (s.slides.length > 1) return <PdpSlideshow slides={s.slides} />;
  const slide = s.slides[0];
  if (!slide) return null;
  return (
    <div className="mb-[25px] mt-[30px] md:mb-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={slide.desktop} alt="" loading="lazy" className="hidden h-auto w-full md:block" style={{ aspectRatio: `${1 / slide.desktopRatio}` }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={slide.mobile ?? slide.desktop}
        alt=""
        loading="lazy"
        className="block h-auto w-full md:hidden"
        style={{ aspectRatio: `${1 / (slide.mobileRatio ?? slide.desktopRatio)}` }}
      />
    </div>
  );
}

/**
 * Product card row: "You may also like" (product-recommendations, h4, 100/50px padding, top border)
 * and the cushion featured collections (h2.h3, section spacing). 4 columns ≥768, swipe row below.
 */
export function CardRow({
  heading,
  cards,
  variant,
}: {
  heading: string;
  cards: CatalogCard[];
  variant: 'recommendations' | 'featured';
}) {
  if (cards.length === 0) return null;
  const recs = variant === 'recommendations';
  return (
    <div className={recs ? 'border-t border-line py-[50px] md:py-[100px]' : 'mb-[25px] mt-[30px] md:mb-10'}>
      <div className="mx-auto max-w-[1360px] px-[12.5px] md:px-10">
        {recs ? (
          <h4 className={`${HEADING.h4} mb-5 text-accent [overflow-wrap:anywhere] md:mb-[45px]`}>{heading}</h4>
        ) : (
          <h2 className={`${HEADING.h3} mb-5 text-accent [overflow-wrap:anywhere] md:mb-[45px]`}>{heading}</h2>
        )}
        <div className="no-scrollbar -mx-[12.5px] mb-5 flex snap-x snap-mandatory scroll-px-[12.5px] gap-[15px] overflow-x-auto px-[12.5px] md:mx-0 md:grid md:grid-cols-4 md:gap-[30px] md:overflow-visible md:px-0">
          {cards.map((card) => (
            <ProductCard key={card.id} product={card} className="mb-5 w-[calc(100vw-69px)] shrink-0 snap-start md:mb-[30px] md:w-auto" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function isRenderable(s: PdpSection): boolean {
  return s.kind !== 'recommendations' && s.kind !== 'reviews' && s.kind !== 'featuredCollection';
}

/** Renders a static template section (overlay, image-with-text, icons, slideshow, testimonials). */
export function StaticSection({ s }: { s: PdpSection }) {
  switch (s.kind) {
    case 'overlay':
      return <ImageWithTextOverlay s={s} />;
    case 'imageText':
      return <ImageWithText s={s} />;
    case 'icons':
      return <TextWithIcons s={s} />;
    case 'slideshow':
      return <Slideshow s={s} />;
    case 'testimonials':
      return <TestimonialsCarousel heading={s.heading} subheading={s.subheading} size={s.size} items={s.items} />;
    default:
      return null;
  }
}
