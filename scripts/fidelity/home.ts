/**
 * Homepage fidelity data (live interwood.pk → Cozy Furnitures).
 *
 * Idempotent. Part of `npm run db:seed` (applyHomeFidelity); can also be run on its own:
 *
 *   npx tsx scripts/fidelity/home.ts
 *
 * - HOME_HERO banners: the live slideshow is image-only. Slides whose artwork carries the old
 *   brand baked in (free-delivery truck, both Coalesce banners) are deactivated; the remaining
 *   four get their live links. Banners are matched by desktop image file, not id, so the script
 *   survives a re-seed.
 * - Admin → Settings → Home page: the live scrolling strip and the live text block at the bottom of the page
 *   (a new shop has neither until the owner writes them).
 * - Hot Selling Products (published "Best seller" products, most recently changed first): the live row's products
 *   are marked best sellers and made the most recently changed, in live order, so they lead the row. Run by
 *   `applyHomeHotSellingOrder` at the very end of the seed, after every step that updates products.
 */
import { PrismaClient } from '@prisma/client';

/** Desktop image → live state. `href: null` keeps the existing href. */
const HERO: Record<string, { active: boolean; href: string | null }> = {
  '/images/banners/home-02.webp': { active: true, href: '/pages/wedding-package-builder' },
  '/images/banners/home-06.webp': { active: false, href: null }, // logo on the truck
  '/images/banners/home-10.jpg': { active: true, href: '/collections/new-arrivals' },
  '/images/banners/home-14.webp': { active: false, href: null }, // "x Coalesce" wordmark
  '/images/banners/home-18.webp': { active: true, href: '/pages/berlin' },
  '/images/banners/home-22.webp': { active: true, href: '/collections/cushions' },
  '/images/banners/home-26.webp': { active: false, href: null }, // "x Coalesce" wordmark
};

/** Live text block (`.text-heading`): heading and paragraphs, verbatim with the shop name. */
const TEXT_HEADING = 'The Same Experience & Quality You Trust Online';
const TEXT_PARAGRAPHS = [
  'At Cozy Furnitures, we understand that convenience is key in today’s fast-paced world, and shopping for furniture should be no exception. That’s why we have revolutionized the way you furnish your home by offering a seamless and hassle-free online shopping experience. Whether you are looking for elegant sofas, modern dining sets, space-saving wardrobes, or stylish office furniture, our online platform provides a one-stop solution to browse, explore, and purchase high-quality furniture from the comfort of your home.',
  'To enhance your online shopping experience, we integrate cutting-edge technology such as augmented reality (AR). This feature allows you to visualize how a particular piece of furniture would look in your own space before making a purchase. By simply using a smartphone or tablet, you can project 3D models of our products into your living rooms, bedrooms, or offices. This eliminates guesswork and provides a realistic preview of how the furniture will fit and complement your interior design. With this innovative tool, you can make informed decisions, ensuring that your chosen pieces align perfectly with your home aesthetics.',
  'The convenience of purchasing Cozy Furnitures furniture online extends beyond product selection. Once you have finalized your choices, the checkout process is simple and secure. Multiple payment options, including credit/debit cards and bank transfers, offer flexibility and peace of mind. Moreover, our online store frequently features exclusive discounts and promotional deals that are not available in physical outlets, making online shopping not only convenient but also cost-effective.',
  'After completing your purchase, you can enjoy the luxury of doorstep delivery. We ensure a smooth and efficient delivery process, handling everything from packaging to transportation with the utmost care. You can track your orders in real-time and receive updates on expected delivery times. In addition, our professional delivery team assembles and sets up the furniture upon arrival, eliminating the hassle of complicated installations. This white-glove service ensures that you receive your furniture in perfect condition without any effort on your part.',
  'Beyond delivery, we prioritize customer satisfaction by offering excellent after-sales support. If you have any inquiries, need assistance with assembly, or wish to return or exchange a product, our dedicated customer service representatives are readily available to provide solutions. Our commitment to quality and service guarantees a worry-free shopping experience, reinforcing trust and loyalty among our valued customers.',
];

const SETTINGS: Record<string, string> = {
  homeStrip: 'FREE Nationwide Delivery!',
  homeTextHeading: TEXT_HEADING,
  homeText: TEXT_PARAGRAPHS.join('\n'),
};

/** Live "Hot Selling Products" row, in live order. */
const HOT_SELLING = [
  'crf-2-door-sliding-wardrobe',
  'alexa-sofa-chair',
  'linea-wardrobe-3-door',
  'cooper-sofa',
  'sofa-majestic-2-seater-velvet-winter-green',
  'antonin-sofa',
  'sydney-trysil-wardrobe-3-doors-light-oak-grey-color',
  'marcus-visitor-chair-waffle-black',
  'visitor-chair-jxn-500m',
];

export async function applyHomeFidelity(prisma: PrismaClient) {
  const banners = await prisma.banner.findMany();
  for (const b of banners) {
    const spec = b.image ? HERO[b.image] : undefined;
    if (!spec) continue;
    await prisma.banner.update({
      where: { id: b.id },
      data: { active: spec.active, ...(spec.href ? { href: spec.href } : {}) },
    });
  }
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  // the old store rating of the removed home reviews block
  await prisma.siteSetting.deleteMany({ where: { key: { in: ['ratingSummary', 'ratingSummaryCount'] } } });
  const active = await prisma.banner.findMany({
    where: { active: true },
    orderBy: { position: 'asc' },
    select: { id: true, href: true, image: true },
  });
  console.log('active home slides:', active);
}

/** The live Hot Selling products become the most recently changed best sellers, first one last-changed. */
export async function applyHomeHotSellingOrder(prisma: PrismaClient) {
  // 1 ms apart and all after every earlier write of the seed (whole seconds back from "now" fell before products the
  // seed had updated a moment earlier, so only the first live product led the row)
  const latest = Date.now() + HOT_SELLING.length;
  for (const [i, handle] of HOT_SELLING.entries()) {
    await prisma.product.updateMany({ where: { handle }, data: { hot: true, updatedAt: new Date(latest - i) } });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  applyHomeFidelity(prisma)
    .then(() => applyHomeHotSellingOrder(prisma))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
