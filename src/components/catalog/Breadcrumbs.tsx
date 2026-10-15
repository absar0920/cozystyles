import Link from 'next/link';

export type Crumb = { label: string; href?: string };

/**
 * Live `nav.breadcrumbs`: plain 13px text links separated by a faint "/", aligned to the
 * 40px header edge (15px on mobile), no chips. Current page is plain text.
 * Pass `className` to adjust spacing (e.g. `px-0` when already inside a container).
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav
      aria-label="breadcrumbs"
      className={`no-scrollbar flex w-full items-center overflow-x-auto whitespace-nowrap px-[15px] py-[10px] text-[13px] font-normal leading-[22.75px] text-accent md:px-10 ${className ?? ''}`}
    >
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center">
            {i > 0 && (
              <i className="mx-2 not-italic opacity-20" aria-hidden>
                /
              </i>
            )}
            {item.href && !last ? (
              <Link href={item.href} className="text-accent hover:text-accent2">
                {item.label}
              </Link>
            ) : (
              <span aria-current={last ? 'page' : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
