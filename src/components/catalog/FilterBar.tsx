'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { formatRs } from '@/components/ui/Price';
import { catalogHref, DISCOUNT_STEPS, filterParams, type CatalogFilters, type SortOption } from './filters';

export type FilterBarProps = {
  /** Listing path, e.g. `/collections/sofas-all` or `/search`. */
  basePath: string;
  filters: CatalogFilters;
  sortOptions: SortOption[];
  /** Value shown when no `sort_by` is set (`manual` for collections, `relevance` for search). */
  defaultSort: string;
  /** Count noun: "products" (collections) or "results" (search). */
  noun: 'products' | 'results';
  total: number;
  inStockCount: number;
  outOfStockCount: number;
  maxPrice: number;
};

type Draft = Pick<CatalogFilters, 'availability' | 'min' | 'max' | 'sort' | 'discount'>;

function hrefFor(props: FilterBarProps, patch: Partial<Draft>): string {
  const next: CatalogFilters = { ...props.filters, ...patch, page: 1 };
  return catalogHref(props.basePath, filterParams(next));
}

function countLabel(n: number, noun: FilterBarProps['noun']): string {
  return `${n} ${n === 1 ? noun.slice(0, -1) : noun}`;
}

/** 6×4 caret drawn like the live `::after` triangle. */
function Caret({ open = false, className = 'right-0' }: { open?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute ${className} top-1/2 -mt-[2px] h-0 w-0 border-x-[3px] border-t-[4px] border-x-transparent ${
        open ? 'rotate-180 border-t-accent2' : 'border-t-accent'
      }`}
    />
  );
}

const checkbox =
  "m-0 mr-[10px] inline-block align-middle h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[2px] border border-[#767676] bg-white bg-center bg-no-repeat checked:border-accent checked:bg-accent checked:bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2210%22%20height=%228%22%20viewBox=%220%200%2010%208%22%3E%3Cpath%20d=%22M1%204l3%203%205-6%22%20fill=%22none%22%20stroke=%22%23fff%22%20stroke-width=%221.5%22/%3E%3C/svg%3E')]";

const priceInput =
  'box-border h-[44px] w-0 flex-1 rounded-btn border border-formline bg-transparent px-4 py-3 text-[13px] text-accent outline-none placeholder:text-black/30 focus:border-accent';

/**
 * Live `facets` toolbar. Desktop (≥768): a border-top row with "Filter:" + Availability / Price
 * dropdowns on the left and "Sort by" select + count on the right; active filters show as pills
 * underneath. Mobile: a sticky "Filter and sort" bar that opens the right-hand facet drawer.
 * Every change navigates to the new Shopify-style URL (server re-renders the grid).
 */
export function FilterBar(props: FilterBarProps) {
  const { filters, sortOptions, defaultSort, noun, total, inStockCount, outOfStockCount, maxPrice } = props;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState<'availability' | 'price' | null>(null);
  const [drawer, setDrawer] = useState(false);

  const go = (href: string) => startTransition(() => router.push(href, { scroll: false }));
  const sortValue = filters.sort ?? defaultSort;

  // Close the drawer / dropdowns whenever the URL-derived filters change.
  const key = JSON.stringify(filters);
  useEffect(() => {
    setOpen(null);
    setDrawer(false);
  }, [key]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  const toggleAvailability = (v: '0' | '1', list: CatalogFilters['availability']) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v].sort().reverse();

  const pills: { label: string; href: string }[] = [];
  for (const a of filters.availability) {
    pills.push({
      label: a === '1' ? 'In stock' : 'Out of stock',
      href: hrefFor(props, { availability: filters.availability.filter((x) => x !== a) }),
    });
  }
  if (filters.min != null || filters.max != null) {
    pills.push({
      label: `${formatRs(filters.min ?? 0)} - ${formatRs(filters.max ?? maxPrice)}`,
      href: hrefFor(props, { min: undefined, max: undefined }),
    });
  }
  if (filters.discount) pills.push({ label: `${filters.discount}%`, href: hrefFor(props, { discount: undefined }) });
  const clearHref = catalogHref(props.basePath, filterParams({ ...filters, availability: [], min: undefined, max: undefined, discount: undefined }));

  return (
    <>
      {/* ---------- mobile sticky bar ---------- */}
      <div className="sticky top-[50px] z-[45] -mx-[12.5px] mb-5 grid grid-cols-[max-content_1fr] border-y border-line bg-white px-[15px] py-[13px] text-[13px] leading-[22.75px] md:hidden">
        <button type="button" onClick={() => setDrawer(true)} className="flex items-center text-accent" aria-haspopup="dialog">
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden className="mb-[2.6px] mr-[10px]">
            <path
              d="M6.55372 7.58824L1 7.58825M11.1818 7.58825L8.40496 7.58824M2.85124 2.41177L1 2.41173M11.1818 2.41173L4.70248 2.41177M4.70248 1V3.82352M8.40496 9V6.17648"
              stroke="#103A3A"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          {/* live: the text node keeps a leading space after the icon */}
          <span className="ml-[3.6px]">Filter and sort</span>
        </button>
        <span className="ml-auto text-right opacity-60">{countLabel(total, noun)}</span>
      </div>

      {/* ---------- desktop toolbar ---------- */}
      <div className="hidden min-h-[65px] border-t border-line pt-[10px] md:block">
        <div className="grid grid-cols-[1fr_max-content_max-content] text-[15px] leading-[26.25px]">
          <div className="flex flex-wrap items-center">
            <span className="mr-[30px] tracking-soft opacity-40">Filter:</span>

            <div className="relative mr-[30px]">
              <button
                type="button"
                onClick={() => setOpen(open === 'availability' ? null : 'availability')}
                aria-expanded={open === 'availability'}
                className={`relative py-[15px] pl-0 pr-[18px] tracking-soft ${open === 'availability' ? 'z-[21] text-accent2' : 'text-accent'}`}
              >
                Availability
                <Caret open={open === 'availability'} />
              </button>
              {open === 'availability' && (
                <div className="absolute left-[-25px] top-full z-[45] w-[350px] border border-line bg-white">
                  <ul className="m-0 max-h-[250px] list-none overflow-y-auto p-6">
                    {(
                      [
                        ['1', 'In stock', inStockCount],
                        ['0', 'Out of stock', outOfStockCount],
                      ] as const
                    ).map(([v, label, n]) => (
                      <li key={v} className="h-[28.9px] text-[17px] leading-[28.9px]">
                        <input
                          id={`avail-d-${v}`}
                          type="checkbox"
                          className={checkbox}
                          checked={filters.availability.includes(v)}
                          disabled={n === 0 && !filters.availability.includes(v)}
                          onChange={() => go(hrefFor(props, { availability: toggleAvailability(v, filters.availability) }))}
                        />
                        <label htmlFor={`avail-d-${v}`} className="cursor-pointer text-[13px] leading-[22.1px] tracking-soft">
                          {` ${label} `}
                        </label>
                        <span className="text-[13px] leading-[22.1px]">{`(${n})`}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between border-t border-line bg-accent/[.02] px-6 py-[18px] text-[13px] leading-none">
                    <span>{`${filters.availability.length} selected`}</span>
                    <Link href={hrefFor(props, { availability: [] })} scroll={false} className="text-accent2 underline hover:text-accent2">
                      Reset
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="relative mr-[30px]">
              <button
                type="button"
                onClick={() => setOpen(open === 'price' ? null : 'price')}
                aria-expanded={open === 'price'}
                className={`relative py-[15px] pl-0 pr-[18px] tracking-soft ${open === 'price' ? 'z-[21] text-accent2' : 'text-accent'}`}
              >
                Price
                <Caret open={open === 'price'} />
              </button>
              {open === 'price' && (
                <div className="absolute left-[-25px] top-full z-[45] w-[350px] border border-line bg-white">
                  <div className="max-h-[250px] overflow-y-auto p-6">
                    <PriceFields
                      idPrefix="d"
                      maxPrice={maxPrice}
                      min={filters.min}
                      max={filters.max}
                      onCommit={(min, max) => go(hrefFor(props, { min, max }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center">
            <label htmlFor="sort-by-d" className="mr-[30px] tracking-soft opacity-40">
              Sort by
            </label>
            <SortSelect
              id="sort-by-d"
              value={sortValue}
              options={sortOptions}
              onChange={(v) => go(hrefFor(props, { sort: v === defaultSort ? undefined : v }))}
              className="h-[52px] py-[17px] text-[15px] leading-[17.25px]"
            />
          </div>
          <div className="ml-[30px] flex items-center opacity-60">{countLabel(total, noun)}</div>
        </div>
        {open && <div className="fixed inset-0 z-20" aria-hidden onClick={() => setOpen(null)} />}
      </div>

      {/* ---------- active filter pills ---------- */}
      <div className="block pb-[14px] text-[11px] leading-[19.25px]">
        {pills.length > 0 && (
          <>
            {pills.map((p) => (
              <Link
                key={p.label}
                href={p.href}
                scroll={false}
                className="mb-2 mr-2 inline-flex h-7 items-center rounded-[14px] border border-accent py-[3px] pl-[15px] pr-3 text-accent hover:bg-accent hover:text-white"
              >
                {p.label}
                <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden className="ml-2">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </Link>
            ))}
            <Link href={clearHref} scroll={false} className="ml-[9px] font-semibold tracking-soft underline underline-offset-2">
              Clear all
            </Link>
          </>
        )}
      </div>

      {/* ---------- mobile facet drawer ---------- */}
      <FacetDrawer {...props} open={drawer} onClose={() => setDrawer(false)} onApply={go} sortValue={sortValue} />
    </>
  );
}

function SortSelect({
  id,
  value,
  options,
  onChange,
  className = '',
}: {
  id: string;
  value: string;
  options: SortOption[];
  onChange: (v: string) => void;
  className?: string;
}) {
  // Live resizes the select to a one-option clone's width: label + 14px padding + ~12.5px native chrome.
  const label = options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '';
  return (
    <span className="relative inline-block">
      <span aria-hidden className={`invisible block whitespace-nowrap pr-[26.5px] ${className}`}>
        {label}
      </span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none border-0 bg-transparent pl-0 pr-[14px] text-accent outline-none ${className}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Caret />
    </span>
  );
}

/** Price input value: integer rupees, shown like live noUiSlider's `0.00` format when `decimals`. */
const fmtPrice = (n: number, decimals: boolean) => (decimals ? n.toFixed(2) : String(n));

/**
 * "The highest price is Rs.…" + two `₨ [input]` cells; commits on Enter, blur or a short pause.
 * With `slider` (the mobile drawer) it adds the live noUiSlider and pre-fills both inputs with the
 * slider values (`0.00` / `479300.00`), as live does; the desktop dropdown keeps empty inputs.
 */
function PriceFields({
  idPrefix,
  maxPrice,
  min,
  max,
  slider = false,
  onCommit,
  onDraft,
}: {
  idPrefix: string;
  maxPrice: number;
  min?: number;
  max?: number;
  slider?: boolean;
  onCommit?: (min: number | undefined, max: number | undefined) => void;
  onDraft?: (min: number | undefined, max: number | undefined) => void;
}) {
  const initial = (v: number | undefined, fallback: number) => (v != null ? fmtPrice(v, slider) : slider ? fmtPrice(fallback, true) : '');
  const [lo, setLo] = useState(initial(min, 0));
  const [hi, setHi] = useState(initial(max, maxPrice));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parse = (s: string) => {
    const n = Number.parseFloat(s.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? Math.round(n) : undefined;
  };
  const commit = (a = lo, b = hi) => {
    if (timer.current) clearTimeout(timer.current);
    const nMin = parse(a);
    const nMax = parse(b);
    if (nMin === min && nMax === max) return;
    onCommit?.(nMin, nMax);
  };
  const change = (a: string, b: string) => {
    setLo(a);
    setHi(b);
    onDraft?.(parse(a), parse(b));
    if (onCommit) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(a, b), 900);
    }
  };
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const loN = Math.min(Math.max(parse(lo) ?? 0, 0), maxPrice);
  const hiN = Math.max(Math.min(parse(hi) ?? maxPrice, maxPrice), loN);

  return (
    <div>
      <span className="mb-[15px] block text-[13px] leading-[22.75px]">The highest price is {formatRs(maxPrice)}</span>
      {slider && (
        <PriceSlider
          max={maxPrice}
          lo={loN}
          hi={hiN}
          onChange={(a, b) => change(fmtPrice(a, true), fmtPrice(b, true))}
        />
      )}
      <div className="grid grid-cols-2 gap-[25px]">
        {(
          [
            ['gte', lo, '0', (v: string) => change(v, hi), 'Minimum price'],
            ['lte', hi, maxPrice.toLocaleString('en-US'), (v: string) => change(lo, v), 'Maximum price'],
          ] as const
        ).map(([k, val, ph, set, aria]) => (
          <div key={k} className="flex items-center">
            {/* live: U+20A8 "₨" (Poppins draws it like "Rs") */}
            <span className="mr-[10px] block text-[13px] leading-[22.75px]">₨</span>
            <input
              id={`price-${idPrefix}-${k}`}
              type="text"
              inputMode="decimal"
              value={val}
              placeholder={ph}
              aria-label={aria}
              onChange={(e) => set(e.target.value.replace(/[^\d.]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && onCommit && commit()}
              onBlur={() => onCommit && commit()}
              className={priceInput}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Grip drawn on live `.noUi-handle` (three 1×6 bars). */
const GRIP = `url("data:image/svg+xml,%3Csvg%20width='5'%20height='6'%20viewBox='0%200%205%206'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3E%3Cpath%20d='M0%200H1V6H0V0Z'%20fill='%23103A3A'/%3E%3Cpath%20d='M2%200H3V6H2V0Z'%20fill='%23103A3A'/%3E%3Cpath%20d='M4%200H5V6H4V0Z'%20fill='%23103A3A'/%3E%3C/svg%3E")`;

/**
 * Live noUiSlider (drawer only): 18px framed box, 4px #eee base with a teal connect between the
 * two 19×18 square handles. Drag with pointer, or arrow keys (1% steps) when a handle is focused.
 */
function PriceSlider({ max, lo, hi, onChange }: { max: number; lo: number; hi: number; onChange: (lo: number, hi: number) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const pct = (v: number) => (max > 0 ? (v / max) * 100 : 0);
  const valueAt = (clientX: number) => {
    const r = base.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.round((Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * max) / 100) * 100;
  };
  const set = (which: 0 | 1, v: number) => (which === 0 ? onChange(Math.min(v, hi), hi) : onChange(lo, Math.max(v, lo)));

  return (
    <div className="relative box-border h-[18px] rounded-[4px] border border-[#d3d3d3] bg-[#fafafa] px-[9px] shadow-[inset_0_1px_1px_#f0f0f0,0_3px_6px_-5px_#bbb]">
      <div ref={base} className="relative h-1 rounded-[3px] bg-line">
        <div className="absolute inset-y-0 bg-accent" style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }} />
        {([0, 1] as const).map((which) => {
          const v = which === 0 ? lo : hi;
          return (
            <div
              key={which}
              role="slider"
              tabIndex={0}
              aria-label={which === 0 ? 'Minimum price' : 'Maximum price'}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={v}
              aria-valuetext={v.toFixed(2)}
              onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
              onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && set(which, valueAt(e.clientX))}
              onKeyDown={(e) => {
                const step = Math.max(1, Math.round(max / 100));
                if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') set(which, Math.max(0, v - step));
                else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') set(which, Math.min(max, v + step));
                else return;
                e.preventDefault();
              }}
              className={`absolute top-[-7px] -ml-[10px] box-border h-[18px] w-[19px] touch-none rounded-[3px] border border-accent bg-white bg-center bg-no-repeat shadow-[inset_0_0_1px_#fff,inset_0_1px_7px_#ebebeb,0_3px_6px_-3px_#bbb] outline-none before:absolute before:left-[14px] before:top-[6px] before:h-[14px] before:w-px before:bg-[#e8e7e6] before:content-[''] after:absolute after:left-[17px] after:top-[6px] after:h-[14px] after:w-px after:bg-[#e8e7e6] after:content-['']`}
              style={{ left: `${pct(v)}%`, zIndex: which === 0 ? 5 : 4, backgroundImage: GRIP }}
            />
          );
        })}
      </div>
    </div>
  );
}

function FacetDrawer({
  open,
  onClose,
  onApply,
  sortValue,
  ...props
}: FilterBarProps & { open: boolean; onClose: () => void; onApply: (href: string) => void; sortValue: string }) {
  const { filters, sortOptions, defaultSort, noun, total, inStockCount, outOfStockCount, maxPrice, basePath } = props;
  const [draft, setDraft] = useState<Draft>({
    availability: filters.availability,
    min: filters.min,
    max: filters.max,
    sort: filters.sort,
    discount: filters.discount,
  });
  const key = JSON.stringify(filters);
  useEffect(() => {
    setDraft({ availability: filters.availability, min: filters.min, max: filters.max, sort: filters.sort, discount: filters.discount });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const clearHref = catalogHref(basePath, filters.q ? [['q', filters.q]] : []);
  const draftSort = draft.sort ?? defaultSort;

  return (
    <div className="md:hidden">
      <div
        className={`click-capture fixed inset-0 z-[10000] transition-opacity duration-[250ms] ease-theme ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter and sort"
        className={`fixed right-0 top-0 z-[10001] h-full w-[calc(100vw-30px)] max-w-[600px] bg-white transition-transform duration-[250ms] ease-theme ${
          open ? 'translate-x-0' : 'invisible translate-x-full'
        }`}
      >
        <div className="grid h-[100dvh] grid-rows-[auto_1fr_auto]">
          <div className="px-5 pt-5">
            <div className="mb-[15px] flex items-end justify-between border-b border-line pb-5">
              <div>
                <h4 className="m-0 text-[28px] font-semibold leading-none">Filter and sort</h4>
                <div className="mt-[10px] text-[13px] leading-[1.4] opacity-60">{countLabel(total, noun)}</div>
              </div>
              <button type="button" onClick={onClose} className="text-[13px] font-medium leading-none text-accent">
                Close
              </button>
            </div>
          </div>

          <div className="overflow-y-auto px-5 pb-5">
            <div className="mb-[25px] mt-[15px]">
              <div className="mb-5 text-[14px] font-semibold uppercase leading-none tracking-title">Discount %</div>
              <ul className="m-0 list-none p-0">
                {DISCOUNT_STEPS.map((d) => (
                  <li key={d} className="border-b border-[#ececec] pl-[.5em] text-[13.6px] leading-[1.7em]">
                    {/* live: inline link (text-sized hit box), so the tap that opens the drawer never hovers it */}
                    <Link
                      href={hrefFor(props, { discount: filters.discount === d ? undefined : d })}
                      scroll={false}
                      className={`hover:text-accent2 focus:text-accent2 ${filters.discount === d ? 'text-accent2' : 'text-accent'}`}
                    >
                      {d}%
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-[25px] border-b border-line pb-[25px]">
              <div className="mb-5 text-[14px] font-semibold uppercase leading-none tracking-title">Availability</div>
              <ul className="m-0 list-none p-0">
                {(
                  [
                    ['1', 'In stock', inStockCount],
                    ['0', 'Out of stock', outOfStockCount],
                  ] as const
                ).map(([v, label, n]) => (
                  <li key={v} className="h-[28.9px] text-[17px] leading-[28.9px]">
                    <input
                      id={`avail-m-${v}`}
                      type="checkbox"
                      className={checkbox}
                      checked={draft.availability.includes(v)}
                      disabled={n === 0 && !draft.availability.includes(v)}
                      onChange={() =>
                        setDraft((d) => ({
                          ...d,
                          availability: d.availability.includes(v) ? d.availability.filter((x) => x !== v) : [...d.availability, v].sort().reverse(),
                        }))
                      }
                    />
                    <label htmlFor={`avail-m-${v}`} className="cursor-pointer text-[13px] leading-[22.1px] tracking-soft">
                      {` ${label} `}
                    </label>
                    <span className="text-[13px] leading-[22.1px]">{`(${n})`}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mb-[25px] border-b border-line pb-[25px]">
              <div className="mb-5 text-[14px] font-semibold uppercase leading-none tracking-title">Price</div>
              <PriceFields
                key={key}
                idPrefix="m"
                maxPrice={maxPrice}
                min={filters.min}
                max={filters.max}
                slider
                // the pre-filled full range (0.00 / max) means "no price filter"
                onDraft={(min, max) =>
                  setDraft((d) => ({ ...d, min: min ? min : undefined, max: max != null && max < maxPrice ? max : undefined }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <label htmlFor="sort-by-m" className="m-0 text-[14px] font-semibold uppercase leading-none tracking-title">
                Sort by
              </label>
              <span className="relative inline-block w-[147px]">
                <select
                  id="sort-by-m"
                  value={draftSort}
                  onChange={(e) => setDraft((d) => ({ ...d, sort: e.target.value === defaultSort ? undefined : e.target.value }))}
                  className="m-0 w-full cursor-pointer appearance-none border-0 bg-transparent py-0 pl-0 pr-[24px] text-[13px] leading-[14.95px] text-accent outline-none"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <Caret className="right-[12px]" />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[7px] border-t border-line p-5">
            <button type="button" className="btn" onClick={() => onApply(hrefFor(props, draft))}>
              <span>Apply</span>
            </button>
            <Link href={clearHref} scroll={false} className="btn-outline">
              <span>Clear</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
