/**
 * Live /pages/catalogues (multicolumn, 3-up). The live tile images carry the old brand mark, so each
 * tile is rebuilt from a logo-free room photo with the same overlay typography: a large thin serif
 * name + small "Catalogue" bottom-left, and the name as a faint vertical watermark on the right.
 * The live PDFs are the old brand's catalogues, so the download links stay inert (`#`).
 */
const CATALOGUES = [
  { name: 'Home', image: '/images/collections/living.jpg' },
  { name: 'Office', image: '/images/collections/office-furniture.jpg' },
  { name: 'Kitchens', image: '/images/collections/kitchen-designs.webp' },
  { name: 'Doors', image: '/images/collections/panel-doors.jpg' },
  { name: 'Wardrobes', image: '/images/collections/wardrobes.jpg' },
];

export function Catalogues() {
  return (
    <div className="section-spacing text-center">
      <div className="mx-auto mb-[25px] max-w-[730px] px-[12.5px] md:mb-10 md:px-10">
        <h2 className="h3 mb-0">Catalogues</h2>
        <div className="rte mt-[10px] px-[15px]">
          <p className="!mb-3">Click on the Catalogue to download</p>
        </div>
      </div>
      <div className="mx-auto flex max-w-[1360px] flex-wrap px-[5px] md:px-[25px]">
        {CATALOGUES.map((cat) => (
          <div key={cat.name} className="mb-10 w-full px-[7.5px] md:w-1/3 md:px-[15px]">
            <a href="#" className="relative mb-7 block w-full overflow-hidden pb-[73.53%] [container-type:inline-size]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cat.image}
                alt={`${cat.name} Catalogue`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
              <span
                aria-hidden
                className="absolute right-[-2cqw] top-1/2 origin-center -translate-y-1/2 translate-x-[35%] rotate-90 whitespace-nowrap font-serif text-[20cqw] font-light leading-none text-white/10"
              >
                {cat.name}
              </span>
              <span className="absolute bottom-[2cqw] left-[2.7cqw] flex items-baseline gap-[1.2cqw] whitespace-nowrap text-left text-white">
                <span className="font-serif text-[9.6cqw] font-light leading-none tracking-[-0.01em] [font-family:Didot,'Bodoni_72','Bodoni_MT',Georgia,serif]">
                  {cat.name}
                </span>
                <span className="font-poppins-thin text-[4.3cqw] font-extralight leading-none text-white/90">Catalogue</span>
              </span>
            </a>
            <a href="#" className="text-button !mr-[15px]">
              click here to download
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
