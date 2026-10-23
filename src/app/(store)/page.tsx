import { getBanners, getSettingsMap } from '@/lib/queries';
import { getCategoryTiles, getHotSellingProducts, stripMessages } from '@/lib/home-data';
import { siteName } from '@/lib/site-url';
import { HeroSlider, type HeroSlide } from '@/components/home/HeroSlider';
import { MarqueeStrip } from '@/components/home/MarqueeStrip';
import { ProductCarousel } from '@/components/home/ProductCarousel';
import { CategoryTiles } from '@/components/home/CategoryTiles';
import { SeoTextBlock } from '@/components/home/SeoTextBlock';

export const dynamic = 'force-dynamic';

/**
 * Home page: banner slideshow (Admin → Banners), the scrolling strip and the text block at the bottom (Admin →
 * Settings → Home page), Hot Selling Products (products ticked "Best seller") and Shop by Category (the Collections
 * page cards with a photo). Each part is left out while it has nothing to show, so a new shop starts with none.
 */
export default async function HomePage() {
  const [bannerRows, hot, tiles, settings] = await Promise.all([
    getBanners(),
    getHotSellingProducts(),
    getCategoryTiles(),
    getSettingsMap(),
  ]);

  const slides: HeroSlide[] = bannerRows
    .filter((b) => b.image)
    .map((b) => ({ id: b.id, title: b.title, href: b.href, image: b.image as string, mobileImage: b.mobileImage }));

  return (
    <>
      <h1 className="sr-only">{siteName()}</h1>

      <HeroSlider slides={slides} />
      <MarqueeStrip messages={stripMessages(settings.homeStrip)} />

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

      <SeoTextBlock heading={(settings.homeTextHeading ?? '').trim()} text={(settings.homeText ?? '').trim()} />
    </>
  );
}
