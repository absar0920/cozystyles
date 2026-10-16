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
 * - Judge.me header summary on the reviews carousel: "4.92 ★ (102)".
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

const SETTINGS: Record<string, string> = {
  ratingSummary: '4.92',
  ratingSummaryCount: '102',
};

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
  const active = await prisma.banner.findMany({
    where: { active: true },
    orderBy: { position: 'asc' },
    select: { id: true, href: true, image: true },
  });
  console.log('active home slides:', active);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  applyHomeFidelity(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
