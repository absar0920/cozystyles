import Link from 'next/link';
import { PackageIcon, SearchIcon } from '@/components/icons';

export type EmptyStateAction = { href: string; label: string };

/** Friendly empty/no-results panel with optional primary + secondary CTAs. */
export function EmptyState({
  title,
  message,
  action,
  secondary,
  icon = 'search',
}: {
  title: string;
  message: string;
  action?: EmptyStateAction;
  secondary?: EmptyStateAction;
  icon?: 'search' | 'package';
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-cream-border bg-cream-soft/70 px-6 py-14 text-center sm:py-20">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-card">
        {icon === 'search' ? (
          <SearchIcon className="h-6 w-6 text-brand" />
        ) : (
          <PackageIcon className="h-6 w-6 text-brand" />
        )}
      </span>
      <h2 className="font-heading text-lg font-semibold text-ink-dark">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{message}</p>
      {(action || secondary) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <Link href={action.href} className="btn-primary !px-6 !py-2.5">
              {action.label}
            </Link>
          )}
          {secondary && (
            <Link href={secondary.href} className="btn-outline !py-2">
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
