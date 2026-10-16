'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import type { MenuNode } from '@/lib/queries';
import { AngleDownIcon, ThemeAccountIcon, ThemeSearchIcon } from '@/components/icons';
import { SearchPanel } from '@/components/layout/SearchPanel';
import { MobileMenu } from '@/components/layout/MobileMenu';
import { megaColumns, isSpacer } from '@/components/layout/menu';

export type AnnouncementProps = {
  text: string;
  href?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

/** Live `.announcement-bar`: centred 11px text + maroon CTA box. Sticky only below 981px. */
export function AnnouncementBar({ text, href, ctaLabel, ctaHref }: AnnouncementProps) {
  if (!text) return null;
  return (
    <div className="sticky top-0 z-[51] min-h-9 bg-accent py-2 text-cream hd:relative">
      <div className="grid grid-cols-[1fr_auto_1fr] px-[12.5px] md:px-10">
        <div />
        <div className="relative flex items-center">
          <p className="m-0 text-[11px] font-normal leading-[18.7px] tracking-ann text-cream">{text}</p>
          {href && <Link href={href} className="absolute inset-0" aria-label={text} />}
          {ctaLabel && ctaHref && (
            <Link
              href={ctaHref}
              className="relative z-[1] ml-[13.2px] inline-block whitespace-nowrap bg-maroon px-[14px] py-[7.92px] text-[13.2px] font-bold leading-[13.2px] text-white hover:text-white"
            >
              {ctaLabel}
            </Link>
          )}
        </div>
        <div />
      </div>
    </div>
  );
}

export function Header({ menu, hasAnnouncement = true }: { menu: MenuNode[]; hasAnnouncement?: boolean }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  // close overlays on navigation
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <header
      className={`header sticky z-50 bg-white shadow-header ${hasAnnouncement ? 'top-[45px] hd:top-0' : 'top-0'}`}
    >
      <div className="relative z-[2] bg-white">
        <div className="flex h-[50px] items-center px-[10px] pt-[5px] md:h-[65px] md:px-[15px] lg:block lg:h-[125px] lg:pt-[15px] min-[1200px]:px-10">
          {/* mobile hamburger */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => {
              setSearchOpen(false);
              setMobileOpen((v) => !v);
            }}
            className="relative -ml-3 h-11 w-11 shrink-0 text-accent lg:hidden"
          >
            <span
              className={`absolute left-3 top-[15px] h-px w-[18px] rounded-[.5px] bg-current transition-transform duration-[250ms] ease-theme ${mobileOpen ? 'translate-y-[6px] rotate-45' : ''}`}
            />
            <span className={`absolute left-3 top-[21px] h-px w-[18px] rounded-[.5px] bg-current transition-opacity ${mobileOpen ? 'opacity-0' : ''}`} />
            <span
              className={`absolute left-3 top-[27px] h-px w-[18px] rounded-[.5px] bg-current transition-transform duration-[250ms] ease-theme ${mobileOpen ? '-translate-y-[6px] -rotate-45' : ''}`}
            />
          </button>

          {/* logo: own centred row on desktop (live margin 15px 0 20px; top as container padding) */}
          <div className="flex min-w-0 flex-1 justify-center lg:mb-5">
            <Link href="/" aria-label="Cozy Furnitures home" className="block">
              <Logo className="h-[35px] max-w-full md:h-10" />
            </Link>
          </div>

          {/* nav row (desktop) + icons */}
          <div className="flex shrink-0 items-center lg:h-[50px]">
            <nav aria-label="Main navigation" className="relative ml-auto hidden lg:block">
              <DesktopNav menu={menu} />
            </nav>
            <ul className="ml-auto flex items-center justify-end lg:min-w-[135px]">
              <li>
                <a
                  href="/search"
                  title="Search"
                  aria-label="Search"
                  aria-expanded={searchOpen}
                  onClick={(e) => {
                    e.preventDefault();
                    setMobileOpen(false);
                    setSearchOpen((v) => !v);
                  }}
                  className="flex px-1 text-accent hover:text-accent2 md:px-[5px]"
                >
                  <ThemeSearchIcon className="h-4 w-4 md:h-5 md:w-[19px]" />
                </a>
              </li>
              <li>
                <Link href="/account/login" title="My Account" aria-label="My Account" className="flex px-1 text-accent hover:text-accent2 md:px-[5px]">
                  <ThemeAccountIcon className="h-4 w-4 md:h-[21px] md:w-[19px]" />
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <SearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />
      <MobileMenu menu={menu} open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </header>
  );
}

/** Globo mega menu (desktop ≥1068): Work Sans 16px/500 black items; full-nav-width square dropdown panels. */
function DesktopNav({ menu }: { menu: MenuNode[] }) {
  // index of the item whose dropdown is suppressed after a click (so navigating closes it)
  const [suppressed, setSuppressed] = useState<number | null>(null);
  return (
    <ul className="flex h-[50px] justify-center gap-px bg-white font-nav" onMouseLeave={() => setSuppressed(null)}>
      {menu.map((item, i) => {
        const highlight = i === 0; // live: first item "Wedding Packages" is a maroon block
        const hasDrop = item.children.length > 0;
        return (
          <li key={item.id} className="group/nav static">
            <MaybeLink
              href={item.href}
              onClick={() => setSuppressed(item.id)}
              className={`flex h-[50px] items-center whitespace-nowrap px-1.5 py-[15px] text-[16px] font-medium leading-5 xl:px-5 ${
                highlight
                  ? 'bg-maroon text-white hover:bg-white hover:text-black'
                  : 'bg-white text-black hover:bg-white hover:text-black'
              }`}
            >
              {item.label}
              {hasDrop && (
                <span className="ml-2.5 flex h-5 w-[9px] items-center justify-center">
                  <AngleDownIcon className="h-[6px] w-[9px]" />
                </span>
              )}
            </MaybeLink>
            {hasDrop && (
              <div
                className={`invisible absolute left-0 top-[42px] z-[1000] w-full border border-megaline bg-white opacity-0 transition-[opacity,visibility] duration-[250ms] ease-theme ${
                  suppressed === item.id ? '' : 'group-hover/nav:visible group-hover/nav:opacity-100 group-focus-within/nav:visible group-focus-within/nav:opacity-100'
                }`}
              >
                <MegaPanel item={item} onNavigate={() => setSuppressed(item.id)} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MegaPanel({ item, onNavigate }: { item: MenuNode; onNavigate: () => void }) {
  const columns = megaColumns(item);
  return (
    <ul className="flex flex-wrap items-start text-left">
      {columns.map((groups, ci) => (
        <li key={ci} className="w-1/4 max-w-[25%] px-[15px]">
          <ul className="py-3">
            {groups.map((group, gi) =>
              group.heading ? (
                <li key={group.heading.id} className={gi > 0 ? 'pt-[15px]' : undefined}>
                  <MaybeLink
                    href={group.heading.href}
                    onClick={onNavigate}
                    className="mb-[7px] block border-b border-cream-border pb-3 text-[14px] font-semibold leading-[23.8px] text-menuRed hover:text-menuRed"
                  >
                    {group.heading.label}
                  </MaybeLink>
                  <ul>
                    {group.links.map((link) => (
                      <MegaLink key={link.id} link={link} onNavigate={onNavigate} />
                    ))}
                  </ul>
                </li>
              ) : (
                group.links.map((link) => <MegaLink key={link.id} link={link} onNavigate={onNavigate} />)
              ),
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function MegaLink({ link, onNavigate }: { link: MenuNode; onNavigate: () => void }) {
  if (isSpacer(link)) return <li aria-hidden className="h-[30px]" />;
  return (
    <li>
      <MaybeLink
        href={link.href}
        onClick={onNavigate}
        className="flex py-[5px] text-[13px] font-normal leading-5 text-ink-dark hover:text-black"
      >
        {link.label}
      </MaybeLink>
    </li>
  );
}

/** A menu entry with no link (empty href, e.g. a column title) renders as a <span> with the same look. */
function MaybeLink({
  href,
  onClick,
  className,
  children,
}: {
  href: string;
  onClick?: () => void;
  className: string;
  children: React.ReactNode;
}) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
