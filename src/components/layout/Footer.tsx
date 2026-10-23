import Link from 'next/link';
import type { MenuNode } from '@/lib/queries';
import { NewsletterForm } from '@/components/layout/NewsletterForm';
import { FacebookIcon, InstagramIcon, LinkedinIcon, YoutubeIcon } from '@/components/icons';

export type FooterSeoGroup = { title: string; items: MenuNode[] };

type FooterProps = {
  /** FOOTER_1, edited under Menus → Footer “About” */
  information: MenuNode[];
  /** FOOTER_2, edited under Menus → Footer “Customer Support” */
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
          {/* headings = the admin's menu tab names (Menus → Footer “About” / Footer “Customer Support”) */}
          <FooterMenu title="About" items={information} className="lg:w-1/6" />
          <FooterMenu title="Customer Support" items={userArea} className="lg:w-1/6" />

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
          <div className="w-full px-[7.5px] md:px-[15px]">
            <p className="m-0 mb-5 text-[13px] leading-[22.1px] opacity-60">© {year} Cozy Furnitures</p>
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
                        {/* "Sofas, Beds, Office chairs": the comma follows the previous link, outside the next one */}
                        {i > 0 && <span className="text-[15.5px] font-light leading-[1.5] text-ink-seo">, </span>}
                        {item.href ? (
                          <Link
                            href={item.href}
                            className="text-[15.5px] font-light leading-[1.5] text-ink-seo no-underline hover:text-accent2"
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <span className="text-[15.5px] font-light leading-[1.5] text-ink-seo no-underline">{item.label}</span>
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
