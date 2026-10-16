import { prisma } from '@/lib/db';
import { getBanners, getSettingsMap, toCard } from '@/lib/queries';
import { HeroSlider, type HeroSlide } from '@/components/home/HeroSlider';
import { MarqueeStrip } from '@/components/home/MarqueeStrip';
import { ProductCarousel, type CarouselProduct } from '@/components/home/ProductCarousel';
import { CategoryTiles, type CategoryTile } from '@/components/home/CategoryTiles';
import { Testimonials } from '@/components/home/Testimonials';
import { SeoTextBlock } from '@/components/home/SeoTextBlock';
import { HOT_SELLING } from '@/components/home/hotSelling';
import { HOME_REVIEWS } from '@/components/home/homeReviews';
import { CARD_SWATCH_SELECT, buildCardSwatches } from '@/lib/card-swatches';

export const dynamic = 'force-dynamic';

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

/** Fetch a fixed list of collections by handle, preserving the given order. */
async function getCollectionsByHandles(handles: readonly string[]): Promise<CategoryTile[]> {
  const rows = await prisma.collection.findMany({
    where: { handle: { in: [...handles] } },
    select: { handle: true, title: true, image: true },
  });
  const byHandle = new Map(rows.map((r) => [r.handle, r]));
  return handles.map((h) => byHandle.get(h)).filter((c): c is CategoryTile => Boolean(c));
}

/** Biggest per-variant discount, like the catalog cards (live sale circle). */
function maxSalePercent(variants: { price: number; compareAtPrice: number | null }[]): number | null {
  const pcts = variants
    .filter((v) => v.compareAtPrice != null && v.compareAtPrice > v.price && v.price > 0)
    .map((v) => Math.round((((v.compareAtPrice as number) - v.price) / (v.compareAtPrice as number)) * 100));
  return pcts.length ? Math.max(...pcts) : null;
}

/** The "Hot Selling Products" cards, in live order, built from the database (SPEC §5.2.4). */
async function getHotSelling(): Promise<CarouselProduct[]> {
  const rows = await prisma.product.findMany({
    where: { handle: { in: HOT_SELLING.map((h) => h.handle) }, status: 'ACTIVE' },
    select: {
      id: true,
      handle: true,
      title: true,
      hot: true,
      rating: true,
      reviewCount: true,
      productType: true,
      variants: { orderBy: { position: 'asc' }, select: { price: true, compareAtPrice: true, status: true } },
      ...CARD_SWATCH_SELECT,
    },
  });
  const byHandle = new Map(rows.map((r) => [r.handle, r]));
  return HOT_SELLING.flatMap((spec) => {
    const row = byHandle.get(spec.handle);
    if (!row) return [];
    const card = toCard({ ...row, images: row.images.slice(0, 1).map((im) => ({ src: im.src, alt: '' })) });
    return [
      {
        ...card,
        hoverImage: row.images[1]?.src ?? null,
        salePercent: spec.salePercent !== undefined ? spec.salePercent : maxSalePercent(row.variants),
        showRating: row.reviewCount > 0,
        swatches: buildCardSwatches(row),
      },
    ];
  });
}

export default async function HomePage() {
  const [bannerRows, hot, tiles, settings] = await Promise.all([
    getBanners(),
    getHotSelling(),
    getCollectionsByHandles(CATEGORY_TILE_HANDLES),
    getSettingsMap(),
  ]);

  const slides: HeroSlide[] = bannerRows
    .filter((b) => b.image)
    .map((b) => ({ id: b.id, title: b.title, href: b.href, image: b.image as string, mobileImage: b.mobileImage }));

  return (
    <>
      <h1 className="sr-only">
        Cozy Furnitures — Pakistan&rsquo;s Largest Furniture Manufacturer. Bedroom, living, dining, office
        furniture, kitchens &amp; wardrobes.
      </h1>

      <HeroSlider slides={slides} />
      <MarqueeStrip />

      {/* Hot Selling Products (live `.featured-collection`) */}
      {hot.length > 0 && (
        <section className="container-iw mt-[35px] min-[881px]:mt-0 min-[881px]:mb-10">
          <div className="mb-[25px] border-b border-[#e3cece] min-[881px]:mx-auto min-[881px]:mb-10 min-[881px]:max-w-[730px] min-[881px]:border-0 min-[881px]:px-10">
            <h2 className="m-0 text-left text-[20.4px] font-semibold leading-[42px] text-accent min-[881px]:text-center min-[881px]:text-[36px] min-[881px]:leading-[44px] lg:text-[40px] lg:leading-[48px]">
              Hot Selling Products
            </h2>
          </div>
          <ProductCarousel products={hot} label="Hot Selling Products" />
        </section>
      )}

      {/* Shop by Category (live `.list-collections`) */}
      {tiles.length > 0 && (
        <section className="mb-[25px] overflow-hidden md:mb-10">
          <div className="container-iw">
            <div className="mb-[25px] md:mb-10">
              <h2 className="m-0 text-center text-[34px] font-semibold leading-[42px] text-accent md:text-[36px] md:leading-[44px] lg:text-[40px] lg:leading-[48px]">Shop by Category</h2>
            </div>
            <CategoryTiles collections={tiles} />
          </div>
        </section>
      )}

      {/* Rich text heading above the reviews widget */}
      <section className="container-iw text-center">
        <div className="mx-auto max-w-[800px]">
          <h3 className="m-0 text-[22.1px] font-semibold leading-[42px] text-accent md:mb-5 md:text-[36px] md:leading-[44px] lg:text-[40px] lg:leading-[48px]">
            Our customer speaks for us
          </h3>
        </div>
      </section>

      <Testimonials
        reviews={HOME_REVIEWS}
        rating={settings.ratingSummary || '4.92'}
        count={settings.ratingSummaryCount || '102'}
      />

      <SeoTextBlock />
    </>
  );
}
