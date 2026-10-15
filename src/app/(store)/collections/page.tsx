import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { CategoryTile } from '@/components/catalog/CategoryTile';
import liveIndex from '@/components/catalog/collections-index.json';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collections',
  description:
    'Browse every Cozy Furnitures category — bedroom, living and dining furniture, office chairs and desks, wardrobes, doors, kitchens, kids furniture and home decor.',
};

type IndexEntry = { handle: string; title: string; image?: string; placeholder?: number };

/** Index cards with no DB row (frontpage / all / all-1): use the image the fidelity script saved. */
function staticImage(handle: string): string | null {
  const dir = path.join(process.cwd(), 'public/images/collections');
  if (!existsSync(dir)) return null;
  const f = readdirSync(dir).find((n) => n.replace(/\.[a-z0-9]+$/i, '') === handle);
  return f ? `/images/collections/${f}` : null;
}

/**
 * Live `/collections` (list-collections section): centred "Shop by Category" header, then every
 * collection on one page as portrait tiles — 3 columns (2 on mobile) — in the live order.
 */
export default async function CollectionsPage() {
  const rows = await prisma.collection.findMany({ select: { handle: true, image: true } });
  const dbImage = new Map(rows.map((r) => [r.handle, r.image]));

  const cards = (liveIndex as IndexEntry[]).flatMap((c) => {
    const inDb = dbImage.has(c.handle);
    const virtual = ['frontpage', 'all', 'all-1'].includes(c.handle);
    if (!inDb && !virtual) return [];
    const image = c.image ? (inDb ? dbImage.get(c.handle) : staticImage(c.handle)) ?? null : null;
    return [{ ...c, image }];
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
              key={c.handle}
              href={`/collections/${c.handle}`}
              title={c.title}
              image={c.image}
              placeholder={c.placeholder ?? 1}
              eager={i < 6}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
