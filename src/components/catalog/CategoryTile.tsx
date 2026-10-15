import Link from 'next/link';

/**
 * Live `.collection-card.style1`: portrait 4:5 image (cover) under an always-on 30% black overlay,
 * zooming to 1.05 on hover, then a 14.4px title. No image → Shopify line-art placeholder on #f6f6f0.
 */
export function CategoryTile({
  href,
  title,
  image,
  placeholder = 1,
  eager = false,
}: {
  href: string;
  title: string;
  image?: string | null;
  placeholder?: number;
  eager?: boolean;
}) {
  return (
    <Link href={href} className="group flex flex-col text-accent hover:text-accent2">
      <div className="relative mb-[10px] overflow-hidden pb-[125%]">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt={title}
            loading={eager ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full object-cover transition-all duration-1000 ease-theme group-hover:scale-105"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/images/catalog/collection-placeholder-${placeholder}.svg`}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            className="absolute inset-0 h-full w-full bg-cream transition-all duration-1000 ease-theme group-hover:scale-105"
          />
        )}
        <span aria-hidden className="absolute inset-0 z-[11] bg-black/30" />
      </div>
      <h2 className="m-0 pb-[5px] text-left text-[14.4px] font-normal leading-none text-inherit">{title}</h2>
    </Link>
  );
}
