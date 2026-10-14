import Link from 'next/link';
import { SofaGlyph } from '@/components/brand/Logo';
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
      <SofaGlyph className="h-auto w-[150px] max-w-full sm:w-[190px]" aria-hidden />

      <p className="mt-6 font-heading text-sm font-bold uppercase tracking-widest text-brand">Error 404</p>
      <h1 className="mt-2 text-2xl font-bold text-ink-dark sm:text-3xl">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-muted sm:text-base">
        The page you&rsquo;re looking for may have been moved, renamed or is temporarily unavailable. Let&rsquo;s help
        you find your way back home.
      </p>

      {/* Search */}
      <form action="/search" method="get" className="mt-8 flex w-full max-w-md items-stretch gap-0">
        <div className="relative flex-1 text-left">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-light" aria-hidden />
          <input
            type="search"
            name="q"
            placeholder="Search beds, sofas, kitchens…"
            aria-label="Search products"
            className="input rounded-l-full border-r-0 pl-10"
          />
        </div>
        <button type="submit" className="btn-primary rounded-l-none rounded-r-full px-6 py-3">
          Search
        </button>
      </form>

      {/* Popular categories */}
      <div className="mt-12 w-full">
        <h2 className="text-xs font-bold uppercase tracking-wider text-ink-muted">Popular Categories</h2>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {POPULAR.map((category) => (
            <Link
              key={category.href}
              href={category.href}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm shadow-card transition hover:-translate-y-0.5 hover:shadow-hover"
            >
              <span className="font-heading font-bold text-ink-dark transition group-hover:text-brand">
                {category.title}
              </span>
              <span className="hidden text-xs text-ink-muted sm:inline">{category.blurb}</span>
              <ChevronRight className="h-3.5 w-3.5 text-brand transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <nav aria-label="Helpful links" className="mt-10 flex flex-wrap items-center justify-center gap-2.5">
        <Link
          href="/"
          className="rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink-dark transition hover:bg-brand hover:text-white"
        >
          Home
        </Link>
        <Link
          href="/collections/all"
          className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink-dark transition hover:bg-brand hover:text-white"
        >
          <PackageIcon className="h-4 w-4 text-brand" aria-hidden />
          All Products
        </Link>
        <Link
          href="/track"
          className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink-dark transition hover:bg-brand hover:text-white"
        >
          <TruckIcon className="h-4 w-4 text-brand" aria-hidden />
          Track Your Order
        </Link>
        <Link
          href="/pages/contact"
          className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-sm font-semibold text-ink-dark transition hover:bg-brand hover:text-white"
        >
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
