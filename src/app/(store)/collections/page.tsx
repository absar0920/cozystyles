import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { getAllNavCollections } from '@/lib/queries';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { CategoryTile } from '@/components/catalog/CategoryTile';
import { ChevronRight, CubeIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'All Categories',
  description:
    'Browse every Cozy Furnitures category — bedroom, living and dining furniture, office chairs and desks, wardrobes, doors, kitchens, kids furniture and home decor.',
};

type NavCollection = Awaited<ReturnType<typeof getAllNavCollections>>[number];

export default async function CollectionsPage() {
  const nav = await getAllNavCollections();

  // Group nav collections by parent: root categories become sections,
  // their children become tiles (grandchildren show as hints on the tile).
  const byParent = new Map<number, NavCollection[]>();
  for (const c of nav) {
    if (c.parentId == null) continue;
    const list = byParent.get(c.parentId) ?? [];
    list.push(c);
    byParent.set(c.parentId, list);
  }

  const roots = nav.filter((c) => c.parentId === null);
  const sections = roots.filter((r) => (byParent.get(r.id)?.length ?? 0) > 0);
  const standalone = roots.filter((r) => (byParent.get(r.id)?.length ?? 0) === 0);

  // Active product count per collection (one grouped query).
  // Note: in `_ProductCollections`, column "A" = collection id, "B" = product id.
  const countRows = await prisma.$queryRawUnsafe<Array<{ cid: bigint; n: bigint }>>(
    `SELECT pc."A" AS cid, COUNT(*) AS n
       FROM "_ProductCollections" pc
       JOIN "Product" pr ON pr."id" = pc."B" AND pr."status" = 'ACTIVE'
       JOIN "Collection" c ON c."id" = pc."A"
      GROUP BY pc."A"`,
  );
  const counts = new Map<number, number>(countRows.map((r) => [Number(r.cid), Number(r.n)]));

  return (
    <>
      <div className="border-b border-cream-border bg-cream">
        <div className="container-iw py-8 sm:py-12">
          <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Collections' }]} className="mb-3" />
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">Our Collections</p>
          <h1 className="mt-1.5 text-2xl font-bold text-ink-dark sm:text-4xl">All Categories</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            {nav.length} collections across bedroom, living, dining, office, doors, kitchens and decor — handcrafted by
            Pakistan&apos;s largest furniture manufacturer, with free delivery &amp; installation nationwide.
          </p>
        </div>
      </div>

      <div className="container-iw space-y-12 py-8 sm:space-y-16 sm:py-12">
        {sections.map((parent) => {
          const kids = byParent.get(parent.id) ?? [];
          return (
            <section key={parent.id} className="space-y-4 sm:space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <span className="hidden h-12 w-12 shrink-0 overflow-hidden rounded-lg sm:block">
                    {parent.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={parent.image}
                        alt={parent.title}
                        loading="lazy"
                        width={48}
                        height={48}
                        className="h-12 w-12 object-cover"
                      />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center bg-brand-50">
                        <CubeIcon className="h-5 w-5 text-brand-300" />
                      </span>
                    )}
                  </span>
                  <div>
                    <h2 className="text-lg font-bold text-ink-dark sm:text-xl">
                      <Link href={`/collections/${parent.handle}`} className="transition hover:text-brand">
                        {parent.title}
                      </Link>
                    </h2>
                    <p className="text-xs text-ink-muted">
                      {kids.length} {kids.length === 1 ? 'subcategory' : 'subcategories'}
                      {(counts.get(parent.id) ?? 0) > 0 ? ` · ${counts.get(parent.id)} products` : ''}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/collections/${parent.handle}`}
                  className="group inline-flex items-center gap-1 pb-0.5 text-xs font-bold uppercase tracking-wider text-brand transition hover:text-brand-600"
                >
                  View all
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {kids.map((kid) => (
                  <CategoryTile
                    key={kid.id}
                    href={`/collections/${kid.handle}`}
                    title={kid.title}
                    image={kid.image}
                    count={counts.get(kid.id)}
                    subItems={(byParent.get(kid.id) ?? []).map((g) => g.title).slice(0, 6)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {standalone.length > 0 && (
          <section className="rounded-2xl bg-cream-soft/70 p-5 shadow-card sm:p-8">
            <h2 className="text-lg font-bold text-ink-dark">More categories</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Every collection in our catalogue — from specialist ranges to signature designer sets.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {standalone.map((c) => {
                const n = counts.get(c.id) ?? 0;
                return (
                  <Link
                    key={c.id}
                    href={`/collections/${c.handle}`}
                    className="rounded-full border border-cream-border bg-white px-3.5 py-1.5 text-xs font-medium text-ink-dark shadow-sm transition hover:border-brand hover:text-brand"
                  >
                    {c.title}
                    {n > 0 ? <span className="ml-1 text-ink-light">({n})</span> : null}
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
