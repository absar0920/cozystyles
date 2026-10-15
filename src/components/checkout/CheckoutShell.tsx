import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { BagIcon } from '@/components/checkout/fields';
import { blueLink } from '@/components/checkout/format';

/** System font stack Shopify checkout / customer accounts render with. */
export const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

/**
 * Hides the storefront chrome (announcement, header, footer, drawer, floating buttons) while a
 * chrome-less page is mounted — Shopify checkout and customer accounts render outside the theme.
 * Plain <style> (no `precedence`) so React removes it again on client navigation away.
 */
export function HideStoreChrome() {
  return (
    <style>{`.theme-store:has([data-bare-page]) > :not(main){display:none !important}`}</style>
  );
}

/** Live checkout footer order (policy modals there; local pages here). */
export const POLICY_LINKS = [
  { label: 'Refund policy', href: '/pages/refund-policy' },
  { label: 'Shipping', href: '/pages/shipping-and-delivery' },
  { label: 'Privacy policy', href: '/pages/privacy-policy' },
  { label: 'Terms of service', href: '/pages/terms-of-use' },
  { label: 'Cancellations', href: '/pages/cancellations' },
  { label: 'Contact', href: '/pages/contact' },
] as const;

export function PolicyLinks() {
  return (
    <footer className="mt-3 py-[21px] min-[1000px]:mt-[48px] min-[1000px]:pt-[14px]">
      <ul className="flex flex-wrap gap-x-[14px] gap-y-[4px] text-[14px] leading-[1.35]">
        {POLICY_LINKS.map((l) => (
          <li key={l.href}>
            {/* live: links are buttons, so each box is the full 18.9px line */}
            <Link href={l.href} className={`inline-block ${blueLink}`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}

/**
 * Shopify one-page checkout frame: logo bar, white main column (499px content, right-aligned) and a
 * full-height #f5f5f5 summary pane with a left rule. Below 1000px it stacks: `mobileTop` (the
 * order-summary toggle) sits between the logo bar and the form; `aside` is desktop-only.
 */
export function CheckoutShell({
  title,
  aside,
  mobileTop,
  children,
}: {
  title: string;
  aside: React.ReactNode;
  mobileTop?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      data-bare-page
      className="min-h-screen bg-white [&_:is(h1,h2,h3,h4)]:[color:inherit] [&_:is(h1,h2,h3,h4)]:[font-family:inherit] text-[14px] leading-[1.35] text-black antialiased"
      style={{ fontFamily: SYSTEM_FONT }}
    >
      <HideStoreChrome />
      <h1 className="sr-only">{title}</h1>

      <header className="border-b border-[#dedede] bg-white">
        <div className="mx-auto flex h-[80px] max-w-[580px] items-center justify-between px-[14px] min-[1000px]:max-w-[980px] min-[1000px]:px-0">
          <Link href="/" aria-label="Cozy Furnitures" className="block">
            <Logo />
          </Link>
          <Link href="/cart" aria-label="Cart" className="flex text-[#005bd1] hover:text-[#004cb0]">
            <BagIcon className="h-6 w-6" />
          </Link>
        </div>
      </header>

      {mobileTop && <div className="min-[1000px]:hidden">{mobileTop}</div>}

      <div className="min-[1000px]:grid min-[1000px]:min-h-[calc(100vh-81px)] min-[1000px]:grid-cols-[calc(50%_+_50px)_minmax(0,1fr)]">
        <main className="bg-white">
          <div className="mx-auto max-w-[580px] px-[14px] pt-5 min-[1000px]:ml-auto min-[1000px]:mr-0 min-[1000px]:max-w-[540px] min-[1000px]:pl-0 min-[1000px]:pr-[41px] min-[1000px]:pt-10">
            {children}
            <PolicyLinks />
          </div>
        </main>
        {/* -ml-px: live draws the pane rule on the last pixel of the main column (x=769 at 1440) */}
        <aside className="-ml-px hidden border-l border-[#dedede] bg-[#f5f5f5] min-[1000px]:block">
          <div className="sticky top-0 max-w-[440px] pl-10 pt-10">{aside}</div>
        </aside>
      </div>
    </div>
  );
}
