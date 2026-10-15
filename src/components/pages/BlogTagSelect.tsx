'use client';

import { useRouter } from 'next/navigation';
import type { ArticleTag } from './content';

/**
 * Live `.blog-header__tags`: a borderless accent2 <select> that sizes itself to the chosen label
 * (an invisible copy of the label sets the width: live app.js `SelectWidth` = label + 24px select
 * padding + 12px) and navigates on change. Live measures before Poppins has loaded, so the label is
 * sized in the generic sans-serif fallback and long labels end up clipped ("Wedding Seasor").
 */
export function BlogTagSelect({
  tags,
  current,
  allHref = '/blogs/news',
}: {
  tags: ArticleTag[];
  current: string;
  allHref?: string;
}) {
  const router = useRouter();
  const options = [{ label: 'All', href: allHref }, ...tags];
  const selected = options.find((o) => o.href === current) ?? options[0];

  return (
    <div className="relative mb-0 inline-block after:pointer-events-none after:absolute after:right-3 after:top-1/2 after:-mt-0.5 after:border-x-[3px] after:border-t-4 after:border-x-transparent after:border-t-accent2 after:content-['']">
      <span aria-hidden className="invisible block whitespace-pre pr-9 font-medium leading-[42px] [font-family:sans-serif]">
        {selected.label}
      </span>
      <select
        aria-label="Filter posts by tag"
        value={selected.href}
        onChange={(e) => router.push(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none border-0 bg-transparent p-0 pr-6 font-medium leading-[42px] text-accent2 outline-none"
      >
        {options.map((o) => (
          <option key={o.href} value={o.href}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
