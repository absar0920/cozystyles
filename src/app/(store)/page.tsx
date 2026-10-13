import Link from 'next/link';
import { ChevronRight } from '@/components/icons';
import {
  getBanners,
  getFeaturedCollections,
  getRecentReviews,
  getSettingsMap,
  listProducts,
} from '@/lib/queries';
import { HeroSlider } from '@/components/home/HeroSlider';
import { TrustStrip } from '@/components/home/TrustStrip';
import { ProductCarousel } from '@/components/home/ProductCarousel';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { RatingBanner } from '@/components/home/RatingBanner';
import { Testimonials } from '@/components/home/Testimonials';

export const dynamic = 'force-dynamic';

/** Category rows shown mid-page, mirroring the real store's home sections. */
const CATEGORY_SECTIONS = [
  { handle: 'bedroom', title: 'Bedroom Furniture' },
  { handle: 'living', title: 'Living Room' },
  { handle: 'dining', title: 'Dining Sets' },
  { handle: 'kids', title: 'Kids Furniture' },
  { handle: 'office', title: 'Office Furniture' },
  { handle: 'kitchens', title: 'Kitchen Designs' },
  { handle: 'wardrobes-1', title: 'Wardrobes' },
] as const;

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="font-heading text-xl font-semibold text-ink-dark sm:text-2xl">{title}</h2>
      <Link
        href={href}
        className="group inline-flex shrink-0 items-center gap-1 pb-0.5 text-sm font-medium text-brand transition hover:text-brand-600"
      >
        View All
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

export default async function HomePage() {
  const [bannerRows, hot, featured, reviewRows, settings] = await Promise.all([
    getBanners('HOME_HERO'),
    listProducts({ perPage: 12 }),
    getFeaturedCollections(10),
    getRecentReviews(10),
    getSettingsMap(),
  ]);
  const sectionResults = await Promise.all(
    CATEGORY_SECTIONS.map((s) => listProducts({ collectionHandle: s.handle, perPage: 8 }))
  );

  const slides = bannerRows.map((b) => ({
    id: b.id,
    title: b.title,
    subtitle: b.subtitle,
    ctaLabel: b.ctaLabel,
    href: b.href,
    image: b.image,
    mobileImage: b.mobileImage,
    textColor: b.textColor,
    overlay: b.overlay,
  }));

  const categoryRows = CATEGORY_SECTIONS.map((s, i) => ({
    handle: s.handle,
    title: s.title,
    products: sectionResults[i].items,
  })).filter((s) => s.products.length > 0);

  const testimonials = reviewRows.map((r) => ({
    id: r.id,
    author: r.author,
    rating: r.rating,
    title: r.title,
    body: r.body,
    product: r.product ? { handle: r.product.handle, title: r.product.title } : null,
  }));

  return (
    <>
      <h1 className="sr-only">
        Interwood — Pakistan&rsquo;s Largest Furniture Manufacturer. Bedroom, living, dining, office
        furniture, kitchens &amp; wardrobes.
      </h1>
      <HeroSlider slides={slides} />
      <TrustStrip />

      {/* Hot Selling Products */}
      {hot.items.length > 0 && (
        <section className="container-iw py-9 lg:py-12">
          <SectionHeader title="Hot Selling Products" href="/collections/all" />
          <ProductCarousel products={hot.items} label="Hot selling products" />
        </section>
      )}

      {/* Shop by Category */}
      {featured.length > 0 && (
        <section className="bg-cream">
          <div className="container-iw py-9 lg:py-12">
            <div className="mb-4 flex items-end justify-between gap-4">
              <h2 className="font-heading text-xl font-semibold text-ink-dark sm:text-2xl">
                Shop by Category
              </h2>
            </div>
            <CategoryTiles collections={featured} />
          </div>
        </section>
      )}

      <RatingBanner rating={settings.ratingSummary} count={settings.ratingSummaryCount} />

      {/* Per-category product rows */}
      {categoryRows.map((row) => (
        <section key={row.handle} className="container-iw py-9 lg:py-12">
          <SectionHeader title={row.title} href={`/collections/${row.handle}`} />
          <ProductCarousel products={row.products} label={row.title} />
        </section>
      ))}

      <Testimonials reviews={testimonials} />
    </>
  );
}
