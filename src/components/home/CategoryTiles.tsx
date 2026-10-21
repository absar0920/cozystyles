import Link from 'next/link';

export type CategoryTile = {
  handle: string;
  title: string;
  image: string | null;
};

/** "Shop by Category" square tiles with a name overlay. Responsive 2/3/5 columns. */
export function CategoryTiles({ collections }: { collections: CategoryTile[] }) {
  if (collections.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {collections.map((c) => (
        <Link
          key={c.handle}
          href={`/collections/${c.handle}`}
          className="group relative block aspect-square overflow-hidden rounded-xl bg-cream-soft shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-hover"
        >
          {c.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.image}
              alt={c.title}
              loading="lazy"
              width={400}
              height={400}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl font-bold text-cream-border">IW</div>
          )}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-80 transition group-hover:opacity-95"
          />
          <span className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 p-3">
            <span className="text-center text-[13px] font-semibold text-white drop-shadow sm:text-sm">
              {c.title}
            </span>
            <span className="text-tiny font-medium text-white/0 transition group-hover:text-white/85">
              Shop Now
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
