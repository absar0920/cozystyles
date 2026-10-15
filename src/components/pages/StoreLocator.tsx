type Location = { name: string; address: string; phone: string; href: string };

export const SHOWROOMS: Location[] = [
  {
    name: 'Garden Town - Lahore',
    address: '7, Babar Block New Garden Town Lahore, 54600',
    phone: '+924235831800',
    href: 'https://goo.gl/maps/nVbQJvVrfj9ZCt8U6',
  },
  {
    name: 'DHA - Islamabad',
    address: 'Main G.T. Road, Opposite DHA Phase-II Gate 4, Rawalpindi, 75500',
    phone: '+92513757632',
    href: 'https://goo.gl/maps/pnjgVW3MZ8thPqax8',
  },
  {
    name: 'I9 - Islamabad',
    address: 'Plot # 390, Street No. 16, Potohar Road, Near I-9 Police Station, Islamabad,',
    phone: '+92514859101',
    href: 'https://goo.gl/maps/Qi8pyMXCnLEYUUMC7',
  },
  {
    name: 'DHA Bukhari - Karachi',
    address: 'Building No. 43-C Bukhari Lane No. 11، D.H.A Phase 6 Bukhari Commercial Area Karachi, 75500',
    phone: '+922135242717',
    href: 'https://goo.gl/maps/YeqUgQDYcd7KH8EL8',
  },
];

export const DEALERS: Location[] = [
  {
    name: 'Mr. Haris Qureshi',
    address: 'SS Tower, Hassan Parwana Road, Near GPO, Dera Adda Multan.',
    phone: '0300-2015000 / 061-4546634',
    href: '#',
  },
  {
    name: 'M/S Waheed Associates',
    address: 'Waheed Associates Building, Dr Ghulam Nabi Road. Front Of Musa Check Post, Quetta',
    phone: '0333-7804950 / 081-2832872',
    href: '#',
  },
  {
    name: 'Mr. Hafeez Jan',
    address: 'GR Floor, Muhammadi Towers,Nasim Nagar Road, Qasimabad. Hyderabad.',
    phone: '0300-8377977 / 022-2670252',
    href: '#',
  },
];

const MAP_SRC =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d217759.99380853778!2d74.3343893!3d31.482940349999996!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39190483e58107d9%3A0xc23abe6ccc7e2462!2sLahore%2C%20Punjab!5e0!3m2!1sen!2s!4v1688549872259!5m2!1sen!2s';

function PinIcon() {
  return (
    <svg role="img" viewBox="0 0 24 24" aria-hidden className="inline w-full align-baseline fill-leaf">
      <path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="inline w-[18px] shrink-0 align-baseline"
    >
      {/* live `path.contact { color: #21b259 }`: the stroke is green too, so the handset reads solid */}
      <path className="text-leaf" d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

/** Live `section.store-locator` (custom section): title, shadowed scroll list (48%) + Lahore map (48%). */
export function StoreLocatorSection({ title, locations }: { title: string; locations: Location[] }) {
  return (
    <section className="py-[30px] md:py-[60px]">
      <div className="mx-auto w-[95%]">
        <h4 className="mb-[15px] text-center !text-[35px] !leading-9 md:mb-10 md:!leading-[38px] md:!text-[48px]">{title}</h4>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between">
          <div className="store-left w-full bg-white px-[25px] py-[30px] shadow-[0_10px_25px_#eae9e9] md:w-[48%]">
            {locations.map((loc) => (
              <div key={loc.name}>
                <h4 className="mb-[10px] !text-[25px] !leading-9 tracking-[.35px] md:!leading-[38px] !text-leaf">{loc.name}</h4>
                <div className="flex items-start gap-[1%]">
                  {/* live `.map_icon` is a shrinkable 20px flex item: long addresses squeeze the pin */}
                  <span className="block w-5">
                    <PinIcon />
                  </span>
                  <p className="mb-[13px] text-[16px] leading-[1.6] tracking-[.35px]">{loc.address}</p>
                </div>
                <div className="flex items-start gap-[1%]">
                  <span className="block shrink-0">
                    <PhoneIcon />
                  </span>
                  <p className="mb-5 leading-[1.7]">{loc.phone}</p>
                </div>
                <a
                  href={loc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="store_btn mb-[30px] inline-block w-full bg-accent px-[10px] py-[7px] text-center text-[18px] text-white"
                >
                  View on Map
                </a>
              </div>
            ))}
          </div>
          <div className="mt-10 w-full md:mt-0 md:w-[48%]">
            <iframe
              src={MAP_SRC}
              title={`${title} map`}
              width={600}
              height={450}
              className="inline h-[450px] w-full border-0 align-baseline"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export function StoreLocatorPage({ dealersOnly = false }: { dealersOnly?: boolean }) {
  return (
    <>
      {!dealersOnly && <StoreLocatorSection title="Store Locator" locations={SHOWROOMS} />}
      <StoreLocatorSection title="Authorized Dealers" locations={DEALERS} />
    </>
  );
}
