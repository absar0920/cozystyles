import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { CategoryTile } from '@/components/catalog/CategoryTile';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collections',
  description:
    'Browse every Cozy Furnitures category — bedroom, living and dining furniture, office chairs and desks, wardrobes, doors, kitchens, kids furniture and home decor.',
};

/**
 * Live `/collections` (list-collections section): centred "Shop by Category" header, then every
 * collection on one page as portrait tiles — 3 columns (2 on mobile) — in the live order.
 */
export default async function CollectionsPage() {
  const rows = await prisma.collectionIndexCard.findMany({
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    include: { collection: { select: { handle: true, title: true, image: true } } },
  });
  const cards = rows.flatMap((c) => {
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

  return (
    <section className="mb-[25px] mt-[50px] md:mb-10 md:mt-[100px]">
      <div className="container-iw">
        {/* live: the mobile section-header is not inside the row padding (x=15, 360 wide) */}
        <div className="-mx-[12.5px] mb-[25px] px-[15px] text-center md:mx-auto md:mb-10 md:max-w-[730px] md:px-10">
          <h1 className="h3 m-0 text-[34px] font-semibold leading-[42px] md:text-[40px] md:leading-[48px]">Shop by Category</h1>
          <div className="mt-[10px] text-[17px] leading-[28.9px]">
            <p className="m-0">Add a short description for your collections</p>
          </div>
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
