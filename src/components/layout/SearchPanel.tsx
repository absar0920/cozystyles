'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import { ThemeCloseIcon } from '@/components/icons';
import { Price } from '@/components/ui/Price';
import { predictiveSearch, type PredictiveResults } from '@/components/layout/actions';

type Tab = 'products' | 'articles' | 'suggestions';
const TABS: { key: Tab; label: string }[] = [
  { key: 'products', label: 'Products' },
  { key: 'articles', label: 'Articles' },
  { key: 'suggestions', label: 'Suggestions' },
];

/** Live `.thb-quick-search`: a full-width panel that slides down from under the header. */
export function SearchPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PredictiveResults | null>(null);
  const [tab, setTab] = useState<Tab>('products');
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      startTransition(async () => {
        const r = await predictiveSearch(term).catch(() => null);
        if (!cancelled) setResults(r);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    onClose();
    router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const term = q.trim();

  return (
    <div
      className={`absolute left-0 top-full z-[1] w-full bg-white shadow-search transition-[transform,visibility] duration-[250ms] ease-theme ${
        open ? 'visible translate-y-0' : 'invisible -translate-y-full'
      }`}
      aria-hidden={!open}
    >
      <form onSubmit={submit} role="search" className="relative border-t border-line px-[15px] py-5 md:px-10">
        <input
          ref={inputRef}
          type="search"
          name="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for anything"
          autoComplete="off"
          aria-label="Search for anything"
          tabIndex={open ? 0 : -1}
          className="h-[52px] w-full border-0 bg-transparent p-0 pr-10 text-[24px] font-normal text-accent outline-none placeholder:text-accent/30 md:text-[34px] [&::-webkit-search-cancel-button]:appearance-none"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          tabIndex={open ? 0 : -1}
          className="absolute right-[15px] top-5 flex h-[52px] w-10 items-center justify-end text-accent md:right-10"
        >
          <ThemeCloseIcon />
        </button>
      </form>

      {results && term.length >= 2 && (
        <div className="border-t border-line px-[15px] pb-[30px] pt-5 md:px-10">
          <div className="mb-[17px] flex">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`relative mr-[30px] text-[15px] font-medium tracking-soft ${
                  tab === t.key ? 'text-accent2 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-accent2' : 'text-accent/70 hover:text-accent'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'products' &&
            (results.products.length ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-x-[30px] gap-y-5">
                {results.products.map((p) => (
                  <Link key={p.handle} href={`/products/${p.handle}`} onClick={onClose} className="group flex items-center">
                    <span className="mr-[30px] block h-[76px] w-[100px] shrink-0 overflow-hidden bg-cream">
                      {p.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-normal leading-[1.5] text-accent group-hover:text-accent2">
                        <Highlight text={p.title} term={term} />
                      </span>
                      {!p.priceOnRequest && <Price price={p.price} compareAt={p.compareAtPrice} className="block leading-[1.6]" />}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyResult term={term} />
            ))}

          {tab === 'articles' &&
            (results.articles.length ? (
              <ul className="space-y-2">
                {results.articles.map((a) => (
                  <li key={a.href}>
                    <Link href={a.href} onClick={onClose} className="text-[15px] text-accent hover:text-accent2">
                      <Highlight text={a.title} term={term} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyResult term={term} />
            ))}

          {tab === 'suggestions' &&
            (results.suggestions.length ? (
              <ul className="space-y-2">
                {results.suggestions.map((s) => (
                  <li key={s.href}>
                    <Link href={s.href} onClick={onClose} className="text-[15px] text-accent hover:text-accent2">
                      <Highlight text={s.label} term={term} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyResult term={term} />
            ))}
        </div>
      )}
    </div>
  );
}

function EmptyResult({ term }: { term: string }) {
  return <p className="m-0 text-[15px] text-accent">No results found for &ldquo;{term}&rdquo;.</p>;
}

/** Wraps case-insensitive matches of `term` in <strong> (live predictive search look). */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${esc})`, 'ig'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <strong key={i} className="font-medium">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
