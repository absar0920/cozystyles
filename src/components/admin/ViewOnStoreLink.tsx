'use client';

import { ExternalLinkIcon } from './icons';

/** "View on store ↗" (new tab). With `href=null` a disabled pill explains why (e.g. "Publish to see it on the store"). */
export function ViewOnStoreLink({ href, label = 'View on store', disabledReason }: { href: string | null; label?: string; disabledReason?: string }) {
  if (!href) {
    return (
      <span
        aria-disabled="true"
        title={disabledReason}
        className="inline-flex min-h-10 cursor-not-allowed items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3.5 text-xs font-semibold text-gray-400"
      >
        <ExternalLinkIcon className="h-3.5 w-3.5" />
        {disabledReason ?? label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 text-xs font-semibold text-ink-dark hover:border-brand-400 hover:text-brand-600"
    >
      {label}
      <ExternalLinkIcon className="h-3.5 w-3.5" />
    </a>
  );
}
