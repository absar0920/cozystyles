'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, useState } from 'react';
import type { MenuNode } from '@/lib/queries';
import { ChevronDown } from '@/components/icons';
import { isSpacer, megaColumns } from '@/components/layout/menu';

/** A menu link; an item without a link renders as plain text with the same look (SPEC R27). */
function MenuLink({ href, className, onClick, tabIndex, children }: { href: string; className: string; onClick?: () => void; tabIndex?: number; children: React.ReactNode }) {
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link href={href} onClick={onClick} tabIndex={tabIndex} className={className}>
      {children}
    </Link>
  );
}

/**
 * Live mobile menu (<1068px): a full-width white panel that opens in place directly under the
 * header (no side drawer). 51px Work Sans rows with #eee rules and chevron accordions. Every row looks
 * the same (no item is highlighted) and there is no account link: the shop has no customer accounts.
 */
export function MobileMenu({ menu, open, onClose }: { menu: MenuNode[]; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);
  const [expanded, setExpanded] = useState<number | null>(null);

  // The floating WhatsApp / back-to-top buttons hide while the menu is open: they would cover the menu rows.
  useLayoutEffect(() => {
    if (!open) return;
    document.documentElement.dataset.mobileMenu = 'open';
    return () => {
      delete document.documentElement.dataset.mobileMenu;
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const header = ref.current?.parentElement;
      if (header) setHeight(window.innerHeight - header.getBoundingClientRect().bottom);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  return (
    <div
      ref={ref}
      className={`absolute left-0 top-full z-[1] flex w-full flex-col overflow-hidden bg-white lg:hidden ${open ? 'visible' : 'invisible'}`}
      style={{ height: height ?? 'calc(100dvh - 95px)' }}
      aria-hidden={!open}
    >
      <nav aria-label="Mobile navigation" className="min-h-0 flex-1 overflow-y-auto font-nav">
        <ul>
          {menu.map((item) => {
            const hasDrop = item.children.length > 0;
            const isOpen = expanded === item.id;
            return (
              <li key={item.id} className="relative">
                <div className="relative">
                  <MenuLink
                    href={item.href}
                    onClick={onClose}
                    tabIndex={open ? 0 : -1}
                    className="flex border-b border-line px-5 py-[15px] text-[16px] font-medium leading-[21px] text-black hover:text-black"
                  >
                    {item.label}
                  </MenuLink>
                  {hasDrop && (
                    <button
                      type="button"
                      aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.label}`}
                      aria-expanded={isOpen}
                      tabIndex={open ? 0 : -1}
                      onClick={() => setExpanded(isOpen ? null : item.id)}
                      className="absolute right-0 top-0 flex h-full w-[70px] items-center justify-end pr-5 text-black"
                    >
                      <ChevronDown className={`h-[22px] w-[22px] transition-transform ${isOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                    </button>
                  )}
                </div>
                {hasDrop && isOpen && <MobileDropdown item={item} onNavigate={onClose} />}
              </li>
            );
          })}
        </ul>
        <ul className="px-[12.5px] py-[30px]" aria-hidden />
      </nav>
    </div>
  );
}

function MobileDropdown({ item, onNavigate }: { item: MenuNode; onNavigate: () => void }) {
  const columns = megaColumns(item);
  return (
    <ul className="border border-megaline bg-white">
      {columns.flat().map((group, gi) => (
        <li key={group.heading?.id ?? `flat-${gi}`} className="px-[15px] py-3">
          {group.heading && (
            <MenuLink
              href={group.heading.href}
              onClick={onNavigate}
              className="mb-[7px] block border-b border-cream-border pb-3 text-[14px] font-semibold leading-[23.8px] text-menuRed hover:text-menuRed"
            >
              <span className="block bg-black/[.03] p-[10px]">{group.heading.label}</span>
            </MenuLink>
          )}
          <ul>
            {group.links.map((link) =>
              isSpacer(link) ? null : (
                <li key={link.id}>
                  <MenuLink
                    href={link.href}
                    onClick={onNavigate}
                    className="flex border-b border-line py-[5px] text-[13px] font-normal leading-5 text-ink-dark hover:text-black"
                  >
                    {link.label}
                  </MenuLink>
                </li>
              ),
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
}
