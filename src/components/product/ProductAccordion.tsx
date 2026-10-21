'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from '@/components/icons';

/** Single collapsible section used under the product buy box (Description, Delivery & Returns, Warranty). */
export function ProductAccordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-cream-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
      >
        <span className="font-heading text-[15px] font-semibold text-ink-dark">{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200 ${open ? 'rotate-180 text-brand' : ''}`}
        />
      </button>
      {open && <div className="rte animate-fadeIn pb-5">{children}</div>}
    </div>
  );
}
