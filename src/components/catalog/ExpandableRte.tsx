'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from '@/components/icons';

/**
 * Renders DB rich-text HTML (`.rte`) that collapses behind a gradient fade
 * with a "Read more" toggle when the content is taller than `collapsedHeight`.
 */
export function ExpandableRte({ html, collapsedHeight = 176 }: { html: string; collapsedHeight?: number }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [needsToggle, setNeedsToggle] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setNeedsToggle(el.scrollHeight > collapsedHeight + 20);
  }, [collapsedHeight, html]);

  return (
    <div>
      <div className="relative">
        <div
          ref={contentRef}
          className="rte overflow-hidden transition-[max-height] duration-300"
          style={expanded ? undefined : { maxHeight: collapsedHeight }}
        >
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        {!expanded && needsToggle && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white via-white/80 to-transparent" />
        )}
      </div>
      {needsToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-brand transition hover:text-brand-600"
        >
          {expanded ? 'Show less' : 'Read more'}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}
