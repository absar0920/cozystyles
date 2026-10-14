'use client';

import { Logo } from '@/components/brand/Logo';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { MenuNode } from '@/lib/queries';
import { useCart } from '@/lib/cart';
import { CartIcon, ChevronDown, MenuIcon, PhoneIcon, SearchIcon, UserIcon, XIcon, ChevronRight } from '@/components/icons';

export function Header({
  menu,
  announcement,
  phone,
  topbarLinks = [],
}: {
  menu: MenuNode[];
  announcement: string;
  phone: string;
  topbarLinks?: { label: string; href: string }[];
}) {
  const { count } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setMobileOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50">
      {/* announcement bar */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-900 text-white">
        <div className="container-iw flex h-9 items-center justify-between gap-4 text-[11.5px]">
          <p className="truncate font-medium tracking-wide">{announcement}</p>
          <div className="hidden items-center gap-4 md:flex">
            <nav aria-label="Top bar links" className="hidden items-center gap-4 lg:flex">
              {topbarLinks.map((link) => (
                <Link key={`${link.href}-${link.label}`} href={link.href} className="whitespace-nowrap rounded-full px-2.5 py-0.5 transition hover:bg-white/10 hover:text-white">
                  {link.label}
                </Link>
              ))}
            </nav>
            <a href={`tel:${phone.replace(/-/g, '')}`} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 font-semibold transition hover:bg-white/10 hover:text-white">
              <PhoneIcon className="h-3.5 w-3.5" /> {phone}
            </a>
          </div>
        </div>
      </div>

      {/* main header */}
      <div className="border-b border-cream-border bg-white">
        <div className="container-iw flex h-[72px] items-center gap-4">
          <button
            type="button"
            aria-label="Open menu"
            className="rounded-full p-2 text-ink-dark transition hover:bg-cream-soft lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <Link href="/" className="shrink-0" aria-label="Cozy Furnitures home">
            <Logo size="md" withTagline />
          </Link>

          {/* desktop search */}
          <form onSubmit={submitSearch} className="ml-auto hidden max-w-xl flex-1 items-center lg:flex">
            <div className="relative w-full">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for sofas, beds, wardrobes, office chairs…"
                className="w-full rounded-full border border-transparent bg-cream-soft py-2.5 pl-5 pr-11 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/25"
              />
              <button type="submit" aria-label="Search" className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-600">
                <SearchIcon className="h-4.5 w-4.5" />
              </button>
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 lg:ml-2">
            <button type="button" aria-label="Search" className="rounded-full p-2.5 text-ink-dark transition hover:bg-cream-soft lg:hidden" onClick={() => setSearchOpen((v) => !v)}>
              <SearchIcon className="h-5.5 w-5.5" />
            </button>
            <Link href="/account/login" aria-label="Login / Account" title="Login" className="hidden rounded-full p-2.5 text-ink-dark transition hover:bg-cream-soft sm:block">
              <UserIcon className="h-5.5 w-5.5" />
            </Link>
            <Link href="/cart" aria-label="Cart" className="relative rounded-full p-2.5 text-ink-dark transition hover:bg-cream-soft">
              <CartIcon className="h-5.5 w-5.5" />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-terra px-1 text-[10.5px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* mobile search drawer */}
        {searchOpen && (
          <form onSubmit={submitSearch} className="container-iw pb-3 lg:hidden">
            <div className="relative">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="w-full rounded-full border border-transparent bg-cream-soft py-2.5 pl-5 pr-11 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/25"
              />
              <button type="submit" aria-label="Search" className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-full bg-brand text-white">
                <SearchIcon className="h-4.5 w-4.5" />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* desktop nav with mega menu */}
      <nav className="hidden border-b border-cream-border bg-white shadow-sm lg:block" aria-label="Main navigation">
        <ul className="container-iw flex h-12 items-stretch">
          {menu.map((item) => (
            <li key={item.id} className="group relative">
              <Link
                href={item.href}
                className="relative flex h-12 items-center gap-1 px-4 text-[13px] font-semibold tracking-wide text-ink-dark transition hover:text-brand"
              >
                {item.label}
                {item.badge && (
                  <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${item.badge === 'SALE' ? 'bg-sale text-white' : 'bg-[#ffd166] text-brand-900'}`}>
                    {item.badge}
                  </span>
                )}
                {item.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 opacity-60 transition group-hover:rotate-180" />}
                <span className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-brand transition-all duration-300 group-hover:w-full" aria-hidden />
              </Link>
              {item.children.length > 0 && <MegaMenu item={item} />}
            </li>
          ))}
          <li className="ml-auto group">
            <Link href="/collections/sale" className="relative flex h-12 items-center px-4 text-[13px] font-semibold tracking-wide text-sale transition hover:text-sale/80">
              Sale — Up to 40% Off
              <span className="absolute bottom-0 left-1/2 h-0.5 w-0 -translate-x-1/2 rounded-full bg-sale transition-all duration-300 group-hover:w-full" aria-hidden />
            </Link>
          </li>
        </ul>
      </nav>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-cream-border p-4">
              <Logo size="sm" withTagline />
              <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded-full p-2 text-ink-dark transition hover:bg-cream-soft">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {menu.map((item) => (
                <MobileMenuItem key={item.id} item={item} onNavigate={() => setMobileOpen(false)} />
              ))}
              <Link href="/track" onClick={() => setMobileOpen(false)} className="block rounded-2xl px-4 py-3 text-sm font-semibold text-ink-dark transition hover:bg-cream-soft">
                Track Order
              </Link>
              <a href={`tel:${phone.replace(/-/g, '')}`} className="flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600">
                <PhoneIcon className="h-4 w-4" /> {phone}
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function MegaMenu({ item }: { item: MenuNode }) {
  const cols = item.children;
  const featured = cols.find((c) => c.children.length > 0) ?? cols[0];
  return (
    <div className="invisible absolute left-0 top-full z-50 min-w-[220px] translate-y-2 pt-2 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
      <div className="grid grid-cols-2 gap-x-10 gap-y-6 rounded-2xl bg-white p-7 shadow-hover" style={{ width: cols.length > 2 ? '760px' : cols.length === 2 ? '480px' : '260px' }}>
        {cols.length > 0 && featured.children.length > 0 ? (
          cols.map((col) => (
            <div key={col.id} className="min-w-[200px]">
              <Link href={col.href} className="mb-2.5 block text-[13px] font-bold uppercase tracking-wide text-brand hover:text-brand-600">
                {col.label}
              </Link>
              <ul className="space-y-1.5">
                {col.children.map((sub) => (
                  <li key={sub.id}>
                    <Link href={sub.href} className="text-[13px] text-ink transition hover:text-brand hover:underline">
                      {sub.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <ul className="space-y-1.5">
            {cols.map((sub) => (
              <li key={sub.id}>
                <Link href={sub.href} className="text-[13px] font-medium text-ink transition hover:text-brand hover:underline">
                  {sub.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function MobileMenuItem({ item, onNavigate }: { item: MenuNode; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl bg-cream-soft/70 transition hover:bg-cream-soft">
      <div className="flex items-center">
        <Link href={item.href} onClick={onNavigate} className="flex-1 px-4 py-3 text-sm font-semibold text-ink-dark">
          {item.label}
          {item.badge && <span className="ml-2 rounded-full bg-[#ffd166] px-1.5 py-0.5 text-[9px] font-bold text-brand-900">{item.badge}</span>}
        </Link>
        {item.children.length > 0 && (
          <button
            type="button"
            aria-label={`Toggle ${item.label}`}
            onClick={() => setOpen((v) => !v)}
            className="mr-3 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-600"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition ${open ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      {open && item.children.length > 0 && (
        <div className="mx-2 mb-2 space-y-1.5 rounded-xl bg-white p-2">
          {item.children.map((child) => (
            <MobileMenuItem key={child.id} item={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
