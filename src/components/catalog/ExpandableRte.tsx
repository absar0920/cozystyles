'use client';

import { useState } from 'react';

/**
 * Live collection description read-more: the collapsed state shows the first 500 characters of
 * the HTML + "...", and a green underlined "Show more" / "Show less" toggle sits centred below.
 * Both strings must already be sanitised (see `./rte`).
 */
export function ExpandableRte({ full, preview, className = '' }: { full: string; preview: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const truncated = preview !== full;
  return (
    <>
      <div className={className} dangerouslySetInnerHTML={{ __html: expanded || !truncated ? full : preview }} />
      {truncated && <ShowMoreButton expanded={expanded} onClick={() => setExpanded((v) => !v)} className="mt-5 self-center" />}
    </>
  );
}

/** Live `.read-more-btn`: transparent, 18px, #21b259, underlined, line-height 1. */
export function ShowMoreButton({
  expanded,
  onClick,
  className = '',
}: {
  expanded: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={`cursor-pointer border-0 bg-transparent p-0 text-[18px] leading-none text-leaf underline ${className}`}
    >
      {expanded ? 'Show less' : 'Show more'}
    </button>
  );
}
