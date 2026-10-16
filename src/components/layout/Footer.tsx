import Link from 'next/link';
import type { MenuNode } from '@/lib/queries';
import { NewsletterForm } from '@/components/layout/NewsletterForm';
import { FacebookIcon, InstagramIcon, LinkedinIcon, YoutubeIcon } from '@/components/icons';

export type FooterSeoGroup = { title: string; items: MenuNode[] };

type FooterProps = {
  information: MenuNode[];
  userArea: MenuNode[];
  seo: FooterSeoGroup[];
  settings: Record<string, string>;
};

const SOCIALS = [
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon },
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { key: 'youtube', label: 'YouTube', Icon: YoutubeIcon },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedinIcon },
] as const;

const CERTIFICATIONS = [
  { src: '/images/theme/FSC_new.png', alt: 'FSC certified' },
  { src: '/images/theme/IAS_upd.png', alt: 'IAS accredited, ISO 9001:2015 certified' },
  { src: '/images/theme/eiac_new.png', alt: 'EIAC accredited' },
  { src: '/images/theme/bmtv_new.png', alt: 'BMTV certified' },
];

/** Live `footer.footer` (cream, 4 widgets + sub-footer) followed by the desktop-only SEO link sections. */
export function Footer({ information, userArea, seo, settings }: FooterProps) {
  const phone = settings.phone ?? '';
  const email = settings.complaintsEmail || settings.email || '';
  const year = new Date().getFullYear();
  const addressLines = (settings.address ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const socials = SOCIALS.filter((s) => /^https?:\/\//i.test(settings[s.key] ?? ''));

  return (
    <>
      <footer className="footer bg-cream pt-[45px] text-[15px] leading-[26.25px] text-accent md:pt-[65px]">
        <div className="mx-auto flex max-w-[1360px] flex-wrap px-[5px] md:px-[25px]">
          <FooterMenu title="Information" items={information} className="lg:w-1/6" />
          <FooterMenu title="User Area" items={userArea} className="lg:w-1/6" />

          <div className={COL}>
            <div className="mb-[30px]">
              <WidgetTitle>Contact Info</WidgetTitle>
              <p className="m-0 text-[15px] leading-[25.5px]">
                {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>}
                {phone && email && <br />}
                {email && <a href={`mailto:${email}`}>{email}</a>}
              </p>
              {addressLines.length > 0 && (
                <p className="m-0 mt-[10px] text-[15px] leading-[25.5px]">
                  {addressLines.map((line, i) => (
                    <span key={i}>
                      {i > 0 && <br />}
                      {line}
                    </span>
                  ))}
                </p>
              )}
              <h4 className="m-0 mt-5 text-[20px] font-semibold leading-[36px] text-accent md:leading-[38px]">Certified by</h4>
              <ul className="flex flex-wrap">
                {CERTIFICATIONS.map((c) => (
                  <li key={c.src} className="mx-[5px] shrink-0 grow-0 basis-[40%]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.src} alt={c.alt} width={180} height={98} loading="lazy" className="mb-5 h-auto w-full" />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={COL}>
            <div className="mb-[30px]">
              <p className="m-0 mb-[25px] text-[16px] font-semibold uppercase leading-none tracking-[.1rem] text-accent max-[480px]:mb-[30px]">
                Follow Us
              </p>
              <ul className="m-0 list-none p-0">
                {socials.map(({ key, label, Icon }) => (
                  <li key={key} className="mr-[15px] inline-block">
                    <a href={settings[key]} target="_blank" rel="noopener noreferrer" aria-label={label}>
                      <Icon className="h-5 w-5 text-accent hover:text-accent2" />
                    </a>
                  </li>
                ))}
              </ul>
              <WidgetTitle>Join our mailing list</WidgetTitle>
              <p className="m-0 mb-[25px] text-[15px] leading-[25.5px]">
                Subscribe to our newsletter to get the latest news and product updates directly to your email. Just a
                second to subscribe today
              </p>
              <NewsletterForm />
            </div>
          </div>
        </div>

        {/* sub-footer */}
        <div className="mx-auto mt-10 flex max-w-[1360px] flex-wrap px-[5px] text-center md:px-[25px] md:text-left">
          <div className="w-full px-[7.5px] md:w-2/3 md:px-[15px]">
            <p className="m-0 mb-5 text-[13px] leading-[22.1px] opacity-60">© {year} Cozy Furnitures</p>
          </div>
          <div className="w-full px-[7.5px] pb-5 md:w-1/3 md:px-[15px] md:pb-0">
            <PaymentIcons />
          </div>
        </div>
      </footer>

      {seo.length > 0 && (
        <div className="hidden bg-white md:block">
          {seo.map((group) => (
            <section key={group.title}>
              <div className="mx-auto max-w-[1360px] px-[25px]">
                <div className="flex pt-[30px]">
                  <div className="w-[320px] shrink-0 text-[18px] font-medium leading-[31.5px] text-black">{group.title}</div>
                  <ul className="mb-5 ml-5 list-none p-0 text-[17px] leading-[1.7]">
                    {group.items.map((item, i) => (
                      <li key={item.id} className="contents">
                        {i > 0 && ' '}
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="text-[15.5px] font-light leading-[1.5] text-ink-seo no-underline hover:text-accent2"
                          >
                            {i > 0 ? `, ${item.label}` : item.label}
                          </Link>
                        ) : (
                          <span className="text-[15.5px] font-light leading-[1.5] text-ink-seo no-underline">
                            {i > 0 ? `, ${item.label}` : item.label}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

// small-6 (50%) · medium-4 (33.3%); 100% at ≤480 (custom.css)
const COL = 'w-full px-[7.5px] min-[481px]:w-1/2 md:w-1/3 md:px-[15px]';

function WidgetTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="m-0 mb-5 font-sans text-[16px] font-semibold uppercase leading-none tracking-title text-accent max-[480px]:text-[19.2px]">
      {children}
    </h3>
  );
}

function FooterMenu({ title, items, className = '' }: { title: string; items: MenuNode[]; className?: string }) {
  return (
    <div className={`${COL} ${className}`}>
      <nav aria-label={title} className="mb-[30px]">
        <WidgetTitle>{title}</WidgetTitle>
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <li key={item.id} className="mb-[5px] leading-[25.5px] last:mb-0">
              {item.href ? (
                <Link href={item.href} className="text-[15px] leading-[25.5px] text-accent hover:text-accent2">
                  {item.label}
                </Link>
              ) : (
                <span className="text-[15px] leading-[25.5px] text-accent">{item.label}</span>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function PaymentIcons() {
  return (
    <div className="flex justify-center gap-[5px] md:justify-end">
      <svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 38 24" width="38" height="24" fill="none" aria-labelledby="pi-american_express">
        <title id="pi-american_express">American Express</title>
        <path d="M35 0H3C1.3 0 0 1.3 0 3V21C0 22.7 1.4 24 3 24H35C36.7 24 38 22.7 38 21V3C38 1.3 36.6 0 35 0Z" fill="#0071CE" />
        <path d="M3 0.5H35C36.3348 0.5 37.5 1.58692 37.5 3V21C37.5 22.4239 36.4239 23.5 35 23.5H3C1.66524 23.5 0.5 22.4131 0.5 21V3C0.5 1.57614 1.57614 0.5 3 0.5Z" stroke="black" strokeOpacity="0.07" />
        <path d="M25.8662 6.33203V3H31L31.8662 5.5332L32.7334 3H37V14.2002H36.7998L34.8672 16.2656L36.7998 18.3594H37V21.2666H33.5996L31.9336 19.3994L30.2002 21.2666H19.4668V12.666H16L20.2666 3H24.4004L25.8662 6.33203ZM20.5996 20.2656H27V18.5322H22.666V17.3994H26.8662V15.666H22.666V14.5322H27V12.7988H20.5996V20.2656ZM30.5332 16.5322L27 20.2656H29.5996L31.8662 17.8662L34.0664 20.2656H36.7324L33.1992 16.4658L36.7324 12.7988H34.1328L31.8662 15.1992L29.7324 12.7988H27L30.5332 16.5322ZM17.666 11.7324H19.9326L20.5332 10.1992H23.999L24.666 11.7324H26.999L23.666 4.19922H20.999L17.666 11.7324ZM33.5996 4.19922L31.9326 8.86621L30.1992 4.19922H27V11.666H29.0664V6.39941L31 11.666H32.7998L34.7324 6.39941V11.666H36.7324V4.13281L33.5996 4.19922ZM23.2656 8.46582H21.2656L22.2656 5.99902L23.2656 8.46582Z" fill="white" />
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 38 24" width="38" height="24" fill="none" aria-labelledby="pi-master">
        <title id="pi-master">Mastercard</title>
        <path d="M35 0H3C1.3 0 0 1.3 0 3V21C0 22.7 1.4 24 3 24H35C36.7 24 38 22.7 38 21V3C38 1.3 36.6 0 35 0Z" fill="#1C1C1C" />
        <path d="M35 1C36.1 1 37 1.9 37 3V21C37 22.1 36.1 23 35 23H3C1.9 23 1 22.1 1 21V3C1 1.9 1.9 1 3 1H35Z" fill="#232323" />
        <path d="M14.6364 19.2727C18.8538 19.2727 22.2727 15.8538 22.2727 11.6364C22.2727 7.41892 18.8538 4 14.6364 4C10.4189 4 7 7.41892 7 11.6364C7 15.8538 10.4189 19.2727 14.6364 19.2727Z" fill="#EB001B" />
        <path d="M23.3637 19.2727C27.5811 19.2727 31 15.8538 31 11.6364C31 7.41892 27.5811 4 23.3637 4C19.1462 4 15.7273 7.41892 15.7273 11.6364C15.7273 15.8538 19.1462 19.2727 23.3637 19.2727Z" fill="#F79E1B" />
        <path d="M22.2727 11.6362C22.2727 9.01797 20.9637 6.72706 19 5.41797C17.0364 6.83615 15.7273 9.12706 15.7273 11.6362C15.7273 14.1452 17.0364 16.5452 19 17.8543C20.9637 16.5452 22.2727 14.2543 22.2727 11.6362Z" fill="#FF5F00" />
      </svg>
      <svg xmlns="http://www.w3.org/2000/svg" role="img" viewBox="0 0 38 24" width="38" height="24" fill="none" aria-labelledby="pi-visa">
        <title id="pi-visa">Visa</title>
        <path d="M35 0H3C1.3 0 0 1.3 0 3V21C0 22.7 1.4 24 3 24H35C36.7 24 38 22.7 38 21V3C38 1.3 36.6 0 35 0Z" fill="#142FBD" />
        <path d="M35 1C36.1 1 37 1.9 37 3V21C37 22.1 36.1 23 35 23H3C1.9 23 1 22.1 1 21V3C1 1.9 1.9 1 3 1H35Z" fill="#1532CB" />
        <path d="M29.5944 10.2167H29.2778C28.8556 11.2722 28.5389 11.8 28.2222 13.3833H30.2278C29.9111 11.8 29.9111 11.0611 29.5944 10.2167V10.2167ZM32.6556 16.4444H30.8611C30.7556 16.4444 30.7556 16.4444 30.65 16.3389L30.4389 15.3889L30.3333 15.1778H27.8C27.6944 15.1778 27.5889 15.1778 27.5889 15.3889L27.2722 16.3389C27.2722 16.4444 27.1667 16.4444 27.1667 16.4444H24.95L25.1611 15.9167L28.2222 8.73889C28.2222 8.21111 28.5389 8 29.0667 8H30.65C30.7556 8 30.8611 8 30.8611 8.21111L32.3389 15.0722C32.4444 15.4944 32.55 15.8111 32.55 16.2333C32.6556 16.3389 32.6556 16.3389 32.6556 16.4444V16.4444ZM18.5111 16.1278L18.9333 14.2278C19.0389 14.2278 19.1444 14.3333 19.1444 14.3333C19.8833 14.65 20.6222 14.8611 21.3611 14.7556C21.5722 14.7556 21.8889 14.65 22.1 14.5444C22.6278 14.3333 22.6278 13.8056 22.2056 13.3833C21.9944 13.1722 21.6778 13.0667 21.3611 12.8556C20.9389 12.6444 20.5167 12.4333 20.2 12.1167C18.9333 11.0611 19.3556 9.58333 20.0944 8.84444C20.7278 8.42222 21.0444 8 21.8889 8C23.1556 8 24.5278 8 25.1611 8.21111H25.2667C25.1611 8.84444 25.0556 9.37222 24.8444 10.0056C24.3167 9.79444 23.7889 9.58333 23.2611 9.58333C22.9444 9.58333 22.6278 9.58333 22.3111 9.68889C22.1 9.68889 21.9944 9.79444 21.8889 9.9C21.6778 10.1111 21.6778 10.4278 21.8889 10.6389L22.4167 11.0611C22.8389 11.2722 23.2611 11.4833 23.5778 11.6944C24.1056 12.0111 24.6333 12.5389 24.7389 13.1722C24.95 14.1222 24.6333 14.9667 23.7889 15.6C23.2611 16.0222 23.05 16.2333 22.3111 16.2333C20.8333 16.2333 19.6722 16.3389 18.7222 16.0222C18.6167 16.2333 18.6167 16.2333 18.5111 16.1278V16.1278ZM14.8167 16.4444C14.9222 15.7056 14.9222 15.7056 15.0278 15.3889C15.5556 13.0667 16.0833 10.6389 16.5056 8.31667C16.6111 8.10556 16.6111 8 16.8222 8H18.7222C18.5111 9.26667 18.3 10.2167 17.9833 11.3778C17.6667 12.9611 17.35 14.5444 16.9278 16.1278C16.9278 16.3389 16.8222 16.3389 16.6111 16.3389L14.8167 16.4444ZM5 8.21111C5 8.10556 5.21111 8 5.31667 8H8.90556C9.43333 8 9.85556 8.31667 9.96111 8.84444L10.9111 13.4889C10.9111 13.5944 10.9111 13.5944 11.0167 13.7C11.0167 13.5944 11.1222 13.5944 11.1222 13.5944L13.3389 8.21111C13.2333 8.10556 13.3389 8 13.4444 8H15.6611C15.6611 8.10556 15.6611 8.10556 15.5556 8.21111L12.2833 15.9167C12.1778 16.1278 12.1778 16.2333 12.0722 16.3389C11.9667 16.4444 11.7556 16.3389 11.5444 16.3389H9.96111C9.85556 16.3389 9.75 16.3389 9.75 16.1278L8.06111 9.58333C7.85 9.37222 7.53333 9.05556 7.11111 8.95C6.47778 8.63333 5.31667 8.42222 5.10556 8.42222L5 8.21111Z" fill="white" />
      </svg>
    </div>
  );
}
