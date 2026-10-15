import { ImageTextSlideshow, type Slide } from './ImageTextSlideshow';

const IMG = '/images/pages/about';

const LEGACY = [
  'In 1974, Cozy Furnitures began as a humble carpentry shop catering to a limited number of customers.',
  'Today, it is the Nation’s largest and most trusted furniture brand, offering a variety of high-quality furniture to countless homes and offices across Pakistan.',
  'Our portfolio of products includes home and office furniture as well as customized designer kitchens, doors, wardrobes, flooring, and more.',
  'All of our furniture is designed and manufactured in our 600,000 sq.ft. manufacturing facility in Lahore, which houses over 300 of Europe’s most advanced machines, including fully-automated robotic machinery. This allows usto ensure that we meet the needs of our growing customer base while maintaining the highest quality and consistency in all our products. All our furniture is displayed in our network of showrooms across the country, ensuring that we cater to customers throughout Pakistan. These flagship showrooms are equipped with experiential displays, allowing customers to imagine how furniture would appear in their spaces even before purchase. Customers are also able to explore and purchase our furniture via our website, ensuring a seamless shopping experience even from home. All our furniture is delivered to our customers’ doorsteps, while being backed by our life-long after sales service, ensuring that your furniture remains at its best for years to come.',
];

const SLIDES: Slide[] = [
  {
    image: `${IMG}/slide-1.jpg`,
    heading: 'Variety of Designs',
    text: 'From traditional designed to contemporary ones, we have a variety of furniture pieces designed to go with every look and style.',
  },
  {
    image: `${IMG}/slide-2.jpg`,
    heading: 'Unmatched Variety',
    text: 'From home and office furniture, to customizable kitchens, doors, and wardrobes, Cozy Furnitures is your one-stop furniture solution for everything you need. Whether you’re building a new home or office, or renovating and existing one, you can find just what you’re looking for with us.',
  },
  {
    image: `${IMG}/slide-3.jpg`,
    heading: 'Trusted Reliability',
    text: 'All of our products are manufactured with the highest standards and materials, while using automated technology to ensure consistency and long-term durability in every piece.',
  },
];

/** `paragraphs` render as separate <p>; `lines` inside one paragraph are joined with <br>. */
const LOCATIONS: { name: string; image: string; paragraphs: string[][] }[] = [
  {
    name: 'I9 - Islamabad',
    image: `${IMG}/i9.jpg`,
    paragraphs: [['Plot # 390, Street No. 16, Potohar Road, Near I-9 Police Station, Islamabad', '+92514859101']],
  },
  {
    name: 'DHA - Islamabad',
    image: `${IMG}/dha.jpg`,
    paragraphs: [['DHA Islamabad'], ['Main G.T. Road, Opposite DHA Phase-II Gate 4, Rawalpindi, 75500', '+92513757632']],
  },
  {
    name: 'Garden Town - Lahore',
    image: `${IMG}/gt.jpg`,
    paragraphs: [['7, Babar Block New Garden Town Lahore, 54600', '+924235831800']],
  },
  {
    name: 'Bukhari Commercial - Karachi',
    image: `${IMG}/karachi.jpg`,
    paragraphs: [
      ['DHA Bukhari'],
      ['Building No. 43-C Bukhari Lane No. 11، D.H.A Phase 6 Bukhari Commercial Area Karachi, 75500'],
      ['+922135242717'],
    ],
  },
  {
    name: 'Head Office - Lahore',
    image: `${IMG}/head-office.jpg`,
    paragraphs: [['56 Sultan Mehmood Road, Shalimar Town, Mehmood Booti, Lahore. 54920', '+924236549123']],
  },
];

const VIDEO_ID = 'cl782Fyqi1U';

/** Live /pages/about-us (template-page-about): video → legacy text → image strip → image+text → slideshow → locations. */
export function AboutPage() {
  return (
    <>
      {/* background-video: muted looping YouTube, 0.2 overlay, no text */}
      <div className="sf-bg-video relative flex h-[500px] items-center overflow-hidden text-center md:h-[550px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          <iframe
            src={`https://www.youtube.com/embed/${VIDEO_ID}?loop=1&autoplay=1&mute=1&playlist=${VIDEO_ID}&controls=0&playsinline=1&iv_load_policy=3&disablekb=1&rel=0`}
            title="Background video"
            allow="autoplay; encrypted-media"
            tabIndex={-1}
            loading="lazy"
          />
        </div>
        <div className="pointer-events-none absolute inset-0 z-[3] bg-black/20" />
      </div>

      {/* rich-text */}
      <div className="container-iw mt-5 text-center">
        <div className="mb-[35px]">
          <h4 className="mb-5">
            <strong className="font-medium">A Legacy of Trust - Since 1974</strong>
          </h4>
          {LEGACY.map((p) => (
            <p key={p.slice(0, 20)} className="leading-[1.7]">
              {p}
            </p>
          ))}
        </div>
      </div>

      {/* page-header strip: heading/content hidden on live; only the image shows */}
      <div className="relative flex min-h-[300px] items-center bg-accent py-[30px] text-left text-white md:p-[60px]">
        <div className="pointer-events-none absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${IMG}/strip.jpg`} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 z-[3] bg-black/20" />
        </div>
        <h1 className="sr-only">About Us</h1>
        {/* live: the toggle is unpositioned, so the background image paints over it */}
        <button type="button" className="bg-transparent text-[18px] leading-none text-leaf underline">
          Show more
        </button>
      </div>

      {/* image-with-text */}
      <div className="container-iw mt-[50px] md:mt-[100px]">
        <div className="flex flex-wrap items-center bg-white md:flex-nowrap">
          <div className="w-full shrink-0 grow-0 md:w-[46%]">
            <div className="relative w-full overflow-hidden pb-[75%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${IMG}/bed.jpg`}
                alt=""
                loading="lazy"
                width={920}
                height={700}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
          <div className="w-full grow p-[25px] md:p-[45px] lg:p-[70px]">
            <h3 className="h4 mb-5">Quality Trusted for Life</h3>
            <div className="rte">
              <p>
                At Cozy Furnitures, all of our furniture products are designed and manufactured with the highest-quality
                standards in mind, ensuring that our customers receive unmatched style and comfort with the benefit of
                great value.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* image-with-text-slideshow */}
      <div className="mt-[50px] md:mt-[100px]">
        <ImageTextSlideshow slides={SLIDES} />
      </div>

      {/* multicolumn: Our Locations */}
      <div className="section-spacing text-center">
        <div className="mx-auto mb-[25px] max-w-[730px] px-[12.5px] md:mb-10 md:px-10">
          <h2 className="h3 mb-0">Our Locations</h2>
        </div>
        <div className="mx-auto flex max-w-[1360px] flex-wrap px-[5px] md:px-[25px]">
          {LOCATIONS.map((loc) => (
            <div key={loc.name} className="mb-10 w-full px-[7.5px] md:w-1/2 md:px-[15px]">
              <div className="relative mb-7 w-full overflow-hidden pb-[100%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={loc.image} alt={loc.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
              </div>
              <h4 className="mb-2">{loc.name}</h4>
              <div className="rte px-[15px]">
                {loc.paragraphs.map((lines) => (
                  <p key={lines[0]} className="!mb-3">
                    {lines.map((line, i) => (
                      <span key={line}>
                        {i > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
