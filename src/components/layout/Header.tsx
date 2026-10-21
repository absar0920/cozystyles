'use client';

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
      <div className="bg-brand-900 text-white">
        <div className="container-iw flex h-9 items-center justify-between gap-4 text-[11.5px]">
          <p className="truncate font-medium tracking-wide">{announcement}</p>
          <div className="hidden items-center gap-4 md:flex">
            <nav aria-label="Top bar links" className="hidden items-center gap-4 lg:flex">
              {topbarLinks.map((link) => (
                <Link key={`${link.href}-${link.label}`} href={link.href} className="whitespace-nowrap transition hover:text-cream">
                  {link.label}
                </Link>
              ))}
            </nav>
            <a href={`tel:${phone.replace(/-/g, '')}`} className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold transition hover:text-cream">
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
            className="rounded-md p-2 text-ink-dark lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <Link href="/" className="shrink-0" aria-label="Interwood home">
            <Image src="/images/logo.png" alt="Interwood" width={165} height={22} priority className="h-9 w-auto" />
          </Link>

          {/* desktop search */}
          <form onSubmit={submitSearch} className="ml-auto hidden max-w-xl flex-1 items-center lg:flex">
            <div className="relative w-full">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for sofas, beds, wardrobes, office chairs…"
                className="w-full rounded-full border border-cream-border bg-cream-soft py-2.5 pl-5 pr-11 text-sm outline-none transition focus:border-brand focus:bg-white"
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
                className="w-full rounded-full border border-cream-border bg-cream-soft py-2.5 pl-5 pr-11 text-sm outline-none focus:border-brand focus:bg-white"
              />
              <button type="submit" aria-label="Search" className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-full bg-brand text-white">
                <SearchIcon className="h-4.5 w-4.5" />
              </button>
            </div>
          </form>
        )}
      </div>

      {/* desktop nav with mega menu */}
      <nav className="hidden bg-brand-900 text-white shadow-sm lg:block" aria-label="Main navigation">
        <ul className="container-iw flex h-12 items-stretch">
          {menu.map((item) => (
            <li key={item.id} className="group relative">
              <Link
                href={item.href}
                className={`flex h-12 items-center gap-1 px-4 text-[13px] font-semibold tracking-wide transition hover:bg-brand-800 ${
                  item.badge === 'SALE' ? 'text-[#ffd7d7]' : ''
                }`}
              >
                {item.label}
                {item.badge && (
                  <span className={`ml-1 rounded px-1.5 py-0.5 text-[9px] font-bold ${item.badge === 'SALE' ? 'bg-sale text-white' : 'bg-[#ffd166] text-brand-900'}`}>
                    {item.badge}
                  </span>
                )}
                {item.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 opacity-80 transition group-hover:rotate-180" />}
              </Link>
              {item.children.length > 0 && <MegaMenu item={item} />}
            </li>
          ))}
        </ul>
      </nav>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-cream-border p-4">
              <Image src="/images/logo.png" alt="Interwood" width={140} height={19} className="h-8 w-auto" />
              <button type="button" aria-label="Close menu" onClick={() => setMobileOpen(false)} className="rounded-md p-2 text-ink-dark">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {menu.map((item) => (
                <MobileMenuItem key={item.id} item={item} onNavigate={() => setMobileOpen(false)} />
              ))}
              <Link href="/track" onClick={() => setMobileOpen(false)} className="block rounded-lg px-4 py-3 text-sm font-semibold text-ink-dark hover:bg-cream-soft">
                Track Order
              </Link>
              <a href={`tel:${phone.replace(/-/g, '')}`} className="mt-2 flex items-center gap-2 rounded-lg bg-brand-900 px-4 py-3 text-sm font-semibold text-white">
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
    <div className="invisible absolute left-0 top-full z-50 min-w-[220px] translate-y-2 pt-0 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
      <div className="grid grid-cols-2 gap-x-10 gap-y-6 rounded-b-xl border-t-2 border-brand bg-white p-7 shadow-hover" style={{ width: cols.length > 2 ? '760px' : cols.length === 2 ? '480px' : '260px' }}>
        {cols.length > 0 && featured.children.length > 0 ? (
          cols.map((col) => (
            <div key={col.id} className="min-w-[200px]">
              <Link href={col.href} className="mb-2.5 block text-[13px] font-bold uppercase tracking-wide text-brand-900 hover:text-brand">
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
    <div className="border-b border-cream-border/70 last:border-0">
      <div className="flex items-center">
        <Link href={item.href} onClick={onNavigate} className="flex-1 px-4 py-3 text-sm font-semibold text-ink-dark">
          {item.label}
          {item.badge && <span className="ml-2 rounded bg-[#ffd166] px-1.5 py-0.5 text-[9px] font-bold text-brand-900">{item.badge}</span>}
        </Link>
        {item.children.length > 0 && (
          <button type="button" aria-label={`Toggle ${item.label}`} onClick={() => setOpen((v) => !v)} className="p-3 text-ink-muted">
            <ChevronRight className={`h-4 w-4 transition ${open ? 'rotate-90' : ''}`} />
          </button>
        )}
      </div>
      {open && item.children.length > 0 && (
        <div className="bg-cream-soft/60 pb-2 pl-4">
          {item.children.map((child) => (
            <MobileMenuItem key={child.id} item={child} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
