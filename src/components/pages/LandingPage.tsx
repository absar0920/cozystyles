import landingData from './landing-data.json';

/** Section shapes written by scripts/fidelity/landing.ts. */
type LandingSection =
  | { kind: 'banner'; image: string; ratio: number }
  | { kind: 'richText'; heading: string | null; html: string }
  | {
      kind: 'imageText';
      image: string;
      ratio: number;
      imageFirst: boolean;
      disableTop: boolean;
      disableBottom: boolean;
      heading: string;
      html: string;
    };

const DATA = landingData as Record<string, LandingSection[]>;


/** Live rte copy: 17px/1.7, underlined inline links, paragraphs flush (no margin between them). */
const RTE =
  'text-[17px] leading-[1.7] text-accent [&_a]:underline [&_a]:underline-offset-[3px] hover:[&_a]:text-accent2';

/**
 * Department landing pages (live `page.home-furniture` / `page.office-furniture` templates):
 * full-width banner, centred rich-text intro, then alternating `image-with-text` rows
 * (46% image, 70px padded centred copy; stacked image-first under 768).
 */
export function LandingPage({ handle }: { handle: string }) {
  const sections = DATA[handle] ?? [];
  return (
    <>
      {sections.map((s, i) => {
        if (s.kind === 'banner') {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={s.image} alt="" className="block h-auto w-full" style={{ aspectRatio: `${100 / s.ratio}` }} />
          );
        }
        if (s.kind === 'richText') {
          return (
            <div key={i} className="px-[30px] py-[50px] text-center">
              <div className="mx-auto max-w-[800px]">
                {s.heading && (
                  <h3 className="mb-5 text-[34px] font-semibold leading-[42px] text-accent md:text-[36px] md:leading-[44px] lg:text-[40px] lg:leading-[48px]">
                    {s.heading}
                  </h3>
                )}
                <div className={`${RTE} mb-[35px]`} dangerouslySetInnerHTML={{ __html: s.html }} />
              </div>
            </div>
          );
        }
        return (
          <div key={i} className="mx-auto flow-root max-w-[1360px] px-[12.5px] md:px-10">
            <div
              className={`flex flex-wrap items-center text-center md:flex-nowrap ${s.imageFirst ? '' : 'md:flex-row-reverse'} ${
                s.disableTop ? '' : 'mt-[25px] md:mt-10'
              } ${s.disableBottom ? '' : 'mb-[25px] md:mb-10'}`}
            >
              <div className="w-full shrink-0 grow-0 md:w-[46%]">
                <div className="relative w-full overflow-hidden" style={{ paddingBottom: `${s.ratio}%` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </div>
              </div>
              <div className="w-full grow p-[25px] md:p-[45px] lg:p-[70px]">
                {/* `!`: content.css sizes every `.sf-page h3` at the h3 scale; live uses the h4 class here */}
                <h3 className="mb-5 !text-[28px] font-semibold !leading-[36px] text-accent md:!text-[30px] md:!leading-[38px]">{s.heading}</h3>
                <div className={RTE} dangerouslySetInnerHTML={{ __html: s.html }} />
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
