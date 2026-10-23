import type { Metadata } from 'next';
import { cache } from 'react';
import { prisma } from '@/lib/db';
import { siteName } from '@/lib/site-url';
import { CategoryTile } from '@/components/catalog/CategoryTile';

export const dynamic = 'force-dynamic';

/** The cards of Admin → Collections → Arrange Collections page, in that order (shared by the page and its metadata). */
const loadCards = cache(async () => {
  const rows = await prisma.collectionIndexCard.findMany({
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    include: { collection: { select: { handle: true, title: true, image: true } } },
  });
  return rows.flatMap((c) => {
    const handle = c.collection?.handle ?? c.systemHandle;
    if (!handle) return [];
    return [
      {
        key: c.id,
        href: `/collections/${handle}`,
        title: c.collection?.title ?? c.systemTitle ?? '',
        image: c.collection?.image ?? c.systemImage ?? null,
        placeholder: c.placeholder,
      },
    ];
  });
});

/** Search-result text: names the collections actually on the page (as many as fit), nothing the shop doesn't sell. */
function collectionsDescription(shop: string, titles: string[]): string {
  const names = [...new Set(titles.map((t) => t.trim()).filter(Boolean))];
  const lead = `Browse the ${shop} collections`;
  if (names.length === 0) return `${lead}.`;
  const text = (n: number) => `${lead}: ${names.slice(0, n).join(', ')}${n < names.length ? ' and more' : ''}.`;
  let n = names.length;
  while (n > 1 && text(n).length > 155) n--;
  return text(n);
}

export async function generateMetadata(): Promise<Metadata> {
  const cards = await loadCards();
  return {
    title: 'Collections',
    description: collectionsDescription(siteName(), cards.map((c) => c.title)),
  };
}

/**
 * Live `/collections` (list-collections section): centred "Shop by Category" header, then every
 * collection on one page as portrait tiles — 3 columns (2 on mobile) — in the saved order.
 */
export default async function CollectionsPage() {
  const cards = await loadCards();

  return (
    <section className="mb-[25px] mt-[50px] md:mb-10 md:mt-[100px]">
      <div className="container-iw">
        {/* live: the mobile section-header is not inside the row padding (x=15, 360 wide) */}
        <div className="-mx-[12.5px] mb-[25px] px-[15px] text-center md:mx-auto md:mb-10 md:max-w-[730px] md:px-10">
          <h1 className="h3 m-0 text-[34px] font-semibold leading-[42px] md:text-[40px] md:leading-[48px]">Shop by Category</h1>
        </div>
        <div className="grid grid-cols-2 gap-x-[10px] gap-y-5 md:grid-cols-3 md:gap-[30px]">
          {cards.map((c, i) => (
            <CategoryTile
              key={c.key}
              href={c.href}
              title={c.title}
              image={c.image}
              placeholder={c.placeholder}
              eager={i < 6}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
