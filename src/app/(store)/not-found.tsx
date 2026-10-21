import Link from 'next/link';
import Image from 'next/image';
import { SearchIcon, ChevronRight, TruckIcon, MailIcon, PackageIcon } from '@/components/icons';

const POPULAR = [
  { title: 'Bedroom', href: '/collections/bedroom', blurb: 'Beds, wardrobes & dressers' },
  { title: 'Living', href: '/collections/living', blurb: 'Sofas, tables & accent chairs' },
  { title: 'Office', href: '/collections/office', blurb: 'Desks, chairs & workstations' },
  { title: 'Kitchens', href: '/collections/kitchens', blurb: 'Modular kitchen designs' },
];

export default function NotFound() {
  return (
    <div className="container-iw flex flex-col items-center py-14 text-center sm:py-20">
      <Image src="/images/logo.png" alt="Interwood" width={180} height={24} priority className="h-9 w-auto" />

      <p className="mt-10 font-heading text-[88px] font-bold leading-none tracking-tight text-brand-900/10 sm:text-[128px]">
        404
      </p>
      <h1 className="-mt-8 text-2xl font-bold text-ink-dark sm:-mt-12 sm:text-3xl">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted sm:text-base">
        The page you&rsquo;re looking for may have been moved, renamed or is temporarily unavailable. Let&rsquo;s help
        you find your way back home.
      </p>

      {/* Search */}
      <form action="/search" method="get" className="mt-8 flex w-full max-w-md items-stretch gap-0">
        <div className="relative flex-1 text-left">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-light" aria-hidden />
          <input
            type="search"
            name="q"
            placeholder="Search beds, sofas, kitchens…"
            aria-label="Search products"
            className="input rounded-r-none !pl-10"
          />
        </div>
        <button type="submit" className="btn-primary rounded-l-none px-5 py-3">
          Search
        </button>
      </form>

      {/* Popular categories */}
      <div className="mt-12 w-full">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Popular Categories</h2>
        <div className="mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {POPULAR.map((category) => (
            <Link
              key={category.href}
              href={category.href}
              className="group rounded-xl border border-cream-border bg-white p-4 text-left shadow-card transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-hover sm:p-5"
            >
              <p className="font-heading text-sm font-bold text-ink-dark transition group-hover:text-brand sm:text-base">
                {category.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">{category.blurb}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                Shop now
                <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <nav aria-label="Helpful links" className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm">
        <Link href="/" className="font-semibold text-ink-dark transition hover:text-brand">
          Home
        </Link>
        <span className="hidden h-1 w-1 rounded-full bg-cream-border sm:inline-block" aria-hidden />
        <Link href="/collections/all" className="inline-flex items-center gap-1.5 font-semibold text-ink-dark transition hover:text-brand">
          <PackageIcon className="h-4 w-4 text-brand" aria-hidden />
          All Products
        </Link>
        <span className="hidden h-1 w-1 rounded-full bg-cream-border sm:inline-block" aria-hidden />
        <Link href="/track" className="inline-flex items-center gap-1.5 font-semibold text-ink-dark transition hover:text-brand">
          <TruckIcon className="h-4 w-4 text-brand" aria-hidden />
          Track Your Order
        </Link>
        <span className="hidden h-1 w-1 rounded-full bg-cream-border sm:inline-block" aria-hidden />
        <Link href="/pages/contact" className="inline-flex items-center gap-1.5 font-semibold text-ink-dark transition hover:text-brand">
          <MailIcon className="h-4 w-4 text-brand" aria-hidden />
          Contact Us
        </Link>
      </nav>

      <p className="mt-10 text-xs text-ink-light">
        Still stuck? Call us at{' '}
        <a href="tel:+9242111203203" className="font-semibold text-brand">
          +92-42-111-203-203
        </a>{' '}
        — we&rsquo;re happy to help.
      </p>
    </div>
  );
}
