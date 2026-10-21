import Link from 'next/link';
import { CubeIcon } from '@/components/icons';

/** Category card used on the /collections index — image (or branded fallback), title, count. */
export function CategoryTile({
  href,
  title,
  image,
  count,
  subItems,
}: {
  href: string;
  title: string;
  image?: string | null;
  count?: number;
  subItems?: string[];
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-xl border border-cream-border bg-white shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-hover"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-cream-soft">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            loading="lazy"
            width={480}
            height={360}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-50 to-cream">
            <CubeIcon className="h-10 w-10 text-brand-200" />
          </div>
        )}
        {count != null && count > 0 && (
          <span className="absolute bottom-2 right-2 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink-dark shadow-sm backdrop-blur-sm">
            {count} {count === 1 ? 'product' : 'products'}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="text-sm font-semibold leading-snug text-ink-dark transition group-hover:text-brand">{title}</h3>
        {subItems && subItems.length > 0 && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">{subItems.join(' · ')}</p>
        )}
      </div>
    </Link>
  );
}
