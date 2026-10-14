'use client';

import { useState, type ReactNode } from 'react';
import { MinusIcon, PlusIcon } from '@/components/icons';

/** Single collapsible card used under the product buy box (Description, Delivery & Returns, Warranty). */
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
    <div className="rounded-2xl border-0 bg-white shadow-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-heading text-[15px] font-semibold text-ink-dark">{title}</span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
          {open ? <MinusIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
        </span>
      </button>
      {open && <div className="rte animate-fadeIn px-5 pb-5">{children}</div>}
    </div>
  );
}
