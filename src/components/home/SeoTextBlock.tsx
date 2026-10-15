'use client';

import { Fragment, useState } from 'react';

const TITLE = 'The Same Experience & Quality You Trust Online';

const PARAGRAPHS = [
  'At Cozy Furnitures, we understand that convenience is key in today’s fast-paced world, and shopping for furniture should be no exception. That’s why we have revolutionized the way you furnish your home by offering a seamless and hassle-free online shopping experience. Whether you are looking for elegant sofas, modern dining sets, space-saving wardrobes, or stylish office furniture, our online platform provides a one-stop solution to browse, explore, and purchase high-quality furniture from the comfort of your home.',
  'To enhance your online shopping experience, we integrate cutting-edge technology such as augmented reality (AR). This feature allows you to visualize how a particular piece of furniture would look in your own space before making a purchase. By simply using a smartphone or tablet, you can project 3D models of our products into your living rooms, bedrooms, or offices. This eliminates guesswork and provides a realistic preview of how the furniture will fit and complement your interior design. With this innovative tool, you can make informed decisions, ensuring that your chosen pieces align perfectly with your home aesthetics.',
  'The convenience of purchasing Cozy Furnitures furniture online extends beyond product selection. Once you have finalized your choices, the checkout process is simple and secure. Multiple payment options, including credit/debit cards and bank transfers, offer flexibility and peace of mind. Moreover, our online store frequently features exclusive discounts and promotional deals that are not available in physical outlets, making online shopping not only convenient but also cost-effective.',
  'After completing your purchase, you can enjoy the luxury of doorstep delivery. We ensure a smooth and efficient delivery process, handling everything from packaging to transportation with the utmost care. You can track your orders in real-time and receive updates on expected delivery times. In addition, our professional delivery team assembles and sets up the furniture upon arrival, eliminating the hassle of complicated installations. This white-glove service ensures that you receive your furniture in perfect condition without any effort on your part.',
  'Beyond delivery, we prioritize customer satisfaction by offering excellent after-sales support. If you have any inquiries, need assistance with assembly, or wish to return or exchange a product, our dedicated customer service representatives are readily available to provide solutions. Our commitment to quality and service guarantees a worry-free shopping experience, reinforcing trust and loyalty among our valued customers.',
];

/**
 * Live collapsed state: the theme cuts the markup at 500 characters and appends "...", ending
 * "...explore, and purcha...". The copy is kept verbatim at every width. On phones the longer
 * brand name ("Cozy Furnitures" vs the live 9-letter name) would push it onto an 11th line, so
 * the collapsed paragraph tightens word spacing by half a pixel below md to keep live's 10 lines.
 */
const COLLAPSED = `${PARAGRAPHS[0].slice(0, PARAGRAPHS[0].indexOf('and purcha') + 'and purcha'.length)}...`;

/**
 * Live `.text-heading` SEO block: beige band, centred 40px heading, paragraph truncated with
 * "...", and a green underlined "Show more" / "Show less" toggle. On mobile the empty right column
 * of the live two-column layout still adds 55px under the text (kept in the bottom padding).
 */
export function SeoTextBlock() {
  const [open, setOpen] = useState(false);
  return (
    <section className="bg-[#f5f5e5] pb-[70px] md:pb-[60px]">
      <div className="mx-5 max-w-[1400px] pt-[35px] text-center md:pt-20 min-[1440px]:mx-auto">
        <h4 className="mb-5 text-[30px] font-semibold leading-[28.5px] text-accent md:text-[40px] md:leading-[38px]">{TITLE}</h4>
        <div className="readmore__content">
          <p
            className={`mb-5 text-[14px] font-normal leading-[23.8px] text-accent md:text-[17px] md:leading-[28.9px] ${
              open ? '' : 'max-md:[word-spacing:-0.5px]'
            }`}
          >
            {open
              ? PARAGRAPHS.map((p, i) => (
                  <Fragment key={i}>
                    {i > 0 && <br />}
                    {p}
                  </Fragment>
                ))
              : COLLAPSED}
          </p>
        </div>
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
      </div>
    </section>
  );
}
