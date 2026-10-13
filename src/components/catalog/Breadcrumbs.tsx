import Link from 'next/link';
import { ChevronRight } from '@/components/icons';

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={`flex flex-wrap items-center gap-1 text-xs text-ink-muted ${className ?? ''}`}>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3 w-3 text-ink-light" aria-hidden />}
            {item.href && !last ? (
              <Link href={item.href} className="transition hover:text-brand">
                {item.label}
              </Link>
            ) : (
              <span className={last ? 'font-semibold text-ink-dark' : undefined} aria-current={last ? 'page' : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
