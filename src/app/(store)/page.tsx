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
import { MarqueeStrip } from '@/components/home/MarqueeStrip';
import { TrustStrip } from '@/components/home/TrustStrip';
import { ProductCarousel } from '@/components/home/ProductCarousel';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { RatingBanner } from '@/components/home/RatingBanner';
import { Testimonials } from '@/components/home/Testimonials';
import { PromoBanner } from '@/components/home/PromoBanner';

export const dynamic = 'force-dynamic';

/** Max featured collections shown as tiles; the first few also get their own product row. */
const FEATURED_LIMIT = 12;
const CATEGORY_ROW_LIMIT = 6;

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
  // Everything here is admin-driven: hero/promo banners, products flagged "Hot",
  // and collections flagged "Featured on homepage" (ordered by position).
  const [bannerRows, strip1, strip2, hot, featured, reviewRows, settings] = await Promise.all([
    getBanners('HOME_HERO'),
    getBanners('HOME_STRIP_1'),
    getBanners('HOME_STRIP_2'),
    listProducts({ hotOnly: true, perPage: 12 }),
    getFeaturedCollections(FEATURED_LIMIT),
    getRecentReviews(10),
    getSettingsMap(),
  ]);
  const rowCollections = featured.slice(0, CATEGORY_ROW_LIMIT);
  const sectionResults = await Promise.all(
    rowCollections.map((c) => listProducts({ collectionHandle: c.handle, perPage: 8 }))
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

  const categoryRows = rowCollections
    .map((c, i) => ({ handle: c.handle, title: c.title, products: sectionResults[i].items }))
    .filter((s) => s.products.length > 0);

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
      <MarqueeStrip />
      <TrustStrip />
      <PromoBanner banners={strip1} />

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
      <PromoBanner banners={strip2} />

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
