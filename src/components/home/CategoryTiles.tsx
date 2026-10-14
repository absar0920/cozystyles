import Link from 'next/link';

export type CategoryTile = {
  handle: string;
  title: string;
  image: string | null;
};

/** Borderless "Shop by Category" tiles: rounded photo, gradient wash, label pill. */
export function CategoryTiles({ collections }: { collections: CategoryTile[] }) {
  if (collections.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
      {collections.map((c) => (
        <Link
          key={c.handle}
          href={`/collections/${c.handle}`}
          className="group relative block aspect-square overflow-hidden rounded-2xl bg-cream-soft"
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
            <div className="flex h-full items-center justify-center text-3xl font-bold text-cream-border">CF</div>
          )}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
          />
          <span className="absolute inset-x-0 bottom-3 flex justify-center px-2">
            <span className="max-w-full truncate rounded-full bg-white/90 px-3.5 py-1.5 text-[13px] font-semibold text-brand-900 shadow-sm sm:text-sm">
              {c.title}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
