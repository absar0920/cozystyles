import Link from 'next/link';
import { ChevronRight } from '@/components/icons';
import { prisma } from '@/lib/db';
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

export const dynamic = 'force-dynamic';

/** Curated Shopify collection powering the "Hot Selling Products" row. */
const HOT_SELLING_COLLECTION = 'hot-selling-items-homepage';

/** Category rows shown mid-page, mirroring the real store's home sections. */
const CATEGORY_SECTIONS = [
  { handle: 'bedroom', title: 'Bedroom Furniture' },
  { handle: 'sofas-all', title: 'Sofas' },
  { handle: 'office-chairs', title: 'Office Chairs' },
  { handle: 'beds', title: 'Beds' },
  { handle: 'dining-table-sets', title: 'Dining Table Sets' },
  { handle: 'kids', title: 'Kids' },
  { handle: 'decor-acc', title: 'Decor' },
] as const;

/** Collections used for the "Shop by Category" tiles, in live-site order. */
const CATEGORY_TILE_HANDLES = [
  'coalesce-bedroom',
  'sofas-all',
  'office-chairs',
  'beds',
  'dining-table-sets',
  'kids',
  'decor-acc',
] as const;

type TileCollection = { handle: string; title: string; image: string | null };

/** Fetch a fixed list of collections by handle, preserving the given order. */
async function getCollectionsByHandles(handles: readonly string[]): Promise<TileCollection[]> {
  const rows = await prisma.collection.findMany({
    where: { handle: { in: [...handles] } },
    select: { handle: true, title: true, image: true },
  });
  const byHandle = new Map(rows.map((r) => [r.handle, r]));
  return handles
    .map((h) => byHandle.get(h))
    .filter((c): c is TileCollection => Boolean(c));
}

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
  const [bannerRows, hotFromCollection, tileCollections, reviewRows, settings] = await Promise.all([
    getBanners('HOME_HERO'),
    listProducts({ collectionHandle: HOT_SELLING_COLLECTION, perPage: 12 }),
    getCollectionsByHandles(CATEGORY_TILE_HANDLES),
    getRecentReviews(10),
    getSettingsMap(),
  ]);
  const sectionResults = await Promise.all(
    CATEGORY_SECTIONS.map((s) => listProducts({ collectionHandle: s.handle, perPage: 8 }))
  );

  // Live site curates "Hot Selling Products" from a dedicated collection; fall
  // back to the default hot-flag listing if that collection has no products.
  const hot =
    hotFromCollection.items.length > 0 ? hotFromCollection : await listProducts({ perPage: 12 });
  const featured =
    tileCollections.length > 0 ? tileCollections : await getFeaturedCollections(10);

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
        Cozy Furnitures — Pakistan&rsquo;s Largest Furniture Manufacturer. Bedroom, living, dining, office
        furniture, kitchens &amp; wardrobes.
      </h1>
      <HeroSlider slides={slides} />
      <MarqueeStrip />
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
