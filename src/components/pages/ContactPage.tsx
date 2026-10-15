import { SITE } from '@/lib/constants';
import { ContactForm } from './ContactForm';

/** Coordinate-only embed of the live map pin (the live embed labels the place with the old brand name). */
const MAP_SRC = 'https://maps.google.com/maps?q=31.6008,74.3893&z=15&output=embed';

/** Live /pages/contact: full-bleed 450px map, then "Contact Us" with the form (8 cols) + info blocks (4 cols). */
export function ContactPage() {
  const blocks = [
    {
      label: 'Email',
      value: (
        <a href={`mailto:${SITE.complaintsEmail}`} className="underline underline-offset-[3px]">
          {SITE.complaintsEmail}
        </a>
      ),
    },
    {
      label: 'Contact',
      value: (
        <a href="tel:021111203203" className="underline underline-offset-[3px]">
          021-111-203-203
        </a>
      ),
    },
    { label: 'Location', value: '7, Babar Block New Garden Town, Lahore, Punjab 54600' },
  ];

  return (
    <>
      <iframe
        src={MAP_SRC}
        title="Map"
        height={450}
        className="inline h-[450px] w-full border-0 align-baseline"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <div className="section-spacing">
        <div className="container-iw">
          <h2 className="h3 mb-[25px] md:mb-10">Contact Us</h2>
        </div>
        <div className="mx-auto flex max-w-[1360px] flex-wrap px-[5px] md:px-[25px]">
          <div className="w-full px-[7.5px] md:w-2/3 md:px-[15px]">
            <ContactForm />
          </div>
          <div className="w-full px-[7.5px] md:w-1/3 md:px-[15px]">
            {blocks.map((block) => (
              <div key={block.label} className="mb-[35px]">
                <strong className="mb-[10px] block font-medium leading-none">{block.label}</strong>
                <div className="rte">
                  <p className="!text-[15px] !leading-[1.7]">{block.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
