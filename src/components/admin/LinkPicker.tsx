'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { resolveLinkTargetsAction, searchLinkTargetsAction } from '@/app/admin/actions/links';
import { LINK_KIND_LABEL, classifyHref, externalLabel, normalizeHref, validateHref, type LinkKind, type LinkTarget } from '@/lib/links';
import { Popover } from './Popover';
import { useUserChangeEvent } from './ui-client';
import { ExternalLinkIcon, LinkIcon, SearchIcon, WarningIcon } from './icons';

export type LinkPickerProps = {
  /** hidden input with the href */
  name?: string;
  /** '' = no link */
  value: string;
  /** `target` is the picked collection/product/page (null for a typed web address or "No link") */
  onChange?: (href: string, target?: LinkTarget | null) => void;
  /** pre-resolved label (server pages pass this to avoid a round trip) */
  initialTarget?: LinkTarget;
  label?: string;
  hint?: string;
  /** default true → "No link" choice */
  allowEmpty?: boolean;
  /** default true */
  allowInternal?: boolean;
  /** default true */
  allowExternal?: boolean;
  required?: boolean;
};

const GROUPS: { title: string; kinds: LinkKind[] }[] = [
  { title: 'Collections', kinds: ['collection'] },
  { title: 'Products', kinds: ['product'] },
  { title: 'Pages', kinds: ['page'] },
  { title: 'Blog posts', kinds: ['blogPost'] },
  { title: 'Shortcuts', kinds: ['home', 'allProducts', 'collectionsIndex', 'blogIndex'] },
];

/** "Collection · Sofas" */
export function linkTargetText(t: LinkTarget | null | undefined, href: string): string {
  if (!href) return 'No link';
  if (!t) {
    const { kind } = classifyHref(href);
    return kind === 'external' && /^https?:/i.test(href) ? `Web address · ${externalLabel(href)}` : 'Loading…';
  }
  if (t.missing) return `${t.label} — pick another`;
  // relative addresses that are not a collection/product/page (e.g. a search results page) are still this store
  const prefix = t.kind === 'external' ? (href.startsWith('/') ? 'This store' : 'Web address') : LINK_KIND_LABEL[t.kind];
  return `${prefix} · ${t.label}${t.detail ? ` (${t.detail})` : ''}`;
}

/** Pick a collection / product / page / blog post, or type a web address. Shows target names, never raw paths. */
export function LinkPicker({
  name,
  value,
  onChange,
  initialTarget,
  label,
  hint,
  allowEmpty = true,
  allowInternal = true,
  allowExternal = true,
  required,
}: LinkPickerProps) {
  const controlled = onChange !== undefined;
  const [inner, setInner] = useState(value ?? '');
  const href = controlled ? value ?? '' : inner;
  const [target, setTarget] = useState<LinkTarget | null>(initialTarget && initialTarget.href === href ? initialTarget : null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'search' | 'custom'>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LinkTarget[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [custom, setCustom] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [requiredError, setRequiredError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const proxyRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const { inputRef, markUserChange } = useUserChangeEvent(href);

  // Resolve the current href to a readable name.
  useEffect(() => {
    if (!href) {
      setTarget(null);
      return;
    }
    if (target?.href === href) return;
    if (initialTarget?.href === href) {
      setTarget(initialTarget);
      return;
    }
    if (!allowInternal) return;
    let cancelled = false;
    resolveLinkTargetsAction([href])
      .then((map) => !cancelled && setTarget(map[href] ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href]);

  // Debounced search while open.
  useEffect(() => {
    if (!open || tab !== 'search' || !allowInternal) return;
    setSearching(true);
    const t = window.setTimeout(() => {
      searchLinkTargetsAction(query)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [query, open, tab, allowInternal]);

  useEffect(() => {
    proxyRef.current?.setCustomValidity(required && !href ? 'Please choose a link' : '');
  }, [required, href]);

  const choose = (next: string, t: LinkTarget | null) => {
    markUserChange();
    setTarget(t);
    if (!controlled) setInner(next);
    onChange?.(next, t);
    setRequiredError(null);
    setOpen(false);
  };

  const openPicker = () => {
    setQuery('');
    setCustom(href && classifyHref(href).kind === 'external' ? href : '');
    setCustomError(null);
    setTab(allowInternal ? 'search' : 'custom');
    setOpen(true);
  };

  const applyCustom = () => {
    const normalized = normalizeHref(custom);
    const err = validateHref(normalized, { allowEmpty: false, allowInternal, allowExternal });
    if (err) {
      setCustomError(err);
      return;
    }
    choose(normalized, null);
  };

  const hidden = name ? <input ref={inputRef} type="hidden" name={name} value={href} /> : null;
  const proxy = required ? (
    <input
      ref={proxyRef}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      required
      value={href}
      onChange={() => {}}
      onInvalid={(e) => {
        e.preventDefault();
        setRequiredError('Please choose a link');
        triggerRef.current?.focus();
      }}
    />
  ) : null;
  const labelEl = label && (
    <label htmlFor={`${id}-field`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
      {label}
    </label>
  );

  // Web-address-only mode (social profile links in Settings).
  if (!allowInternal) {
    const err = href ? validateHref(href, { allowEmpty, allowInternal: false, allowExternal: true }) : null;
    return (
      <div data-testid="link-picker">
        {labelEl}
        <div className="flex gap-2">
          <input
            id={`${id}-field`}
            type="url"
            inputMode="url"
            value={href}
            placeholder="https://"
            onChange={(e) => {
              markUserChange();
              const v = e.target.value.trim();
              if (!controlled) setInner(v);
              onChange?.(v);
            }}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
              err ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-300 focus:border-brand focus:ring-brand/20'
            }`}
          />
          <a
            href={!err && href ? href : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!href || !!err}
            className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold ${
              !href || err ? 'pointer-events-none border-gray-200 text-gray-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Open
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        </div>
        {err && <p className="mt-1 text-xs font-medium text-red-600">{err}</p>}
        {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        {hidden}
        {proxy}
      </div>
    );
  }

  const text = linkTargetText(target, href);
  const missing = !!target?.missing;
  const grouped = GROUPS.map((g) => ({ ...g, items: (results ?? []).filter((r) => g.kinds.includes(r.kind)) })).filter((g) => g.items.length);

  return (
    <div data-testid="link-picker">
      {labelEl}
      <button
        id={`${id}-field`}
        ref={triggerRef}
        type="button"
        aria-label="Choose link"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`flex min-h-11 w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm transition hover:border-brand-400 ${
          missing || requiredError ? 'border-red-300' : 'border-gray-300'
        }`}
      >
        {missing ? <WarningIcon className="h-4 w-4 shrink-0 text-red-500" /> : <LinkIcon className="h-4 w-4 shrink-0 text-gray-400" />}
        <span data-testid="link-picker-value" className={`min-w-0 flex-1 truncate ${missing ? 'font-medium text-red-600' : href ? 'text-ink-dark' : 'text-gray-400'}`}>
          {text}
        </span>
        <span className="shrink-0 text-xs font-semibold text-brand-600">Change</span>
      </button>
      {requiredError && <p className="mt-1 text-xs font-medium text-red-600">{requiredError}</p>}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
      {hidden}
      {proxy}

      <Popover open={open} anchorRef={triggerRef} onClose={() => setOpen(false)} title="Choose a link" width={400} testId="link-picker-popover">
        {allowExternal && (
          <div role="tablist" className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
            {(['search', 'custom'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`min-h-10 rounded-md text-sm font-semibold ${tab === t ? 'bg-white text-ink-dark shadow-sm' : 'text-gray-500'}`}
              >
                {t === 'search' ? 'This store' : 'Custom web address'}
              </button>
            ))}
          </div>
        )}

        {tab === 'search' ? (
          <div>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search collections, products, pages…"
                aria-label="Search collections, products, pages"
                className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="mt-2 min-h-24" aria-live="polite">
              {results == null || (searching && !results.length) ? (
                <p className="px-1 py-3 text-sm text-gray-500">Searching…</p>
              ) : grouped.length === 0 ? (
                <p className="px-1 py-3 text-sm text-gray-500">Nothing found. Try another word.</p>
              ) : (
                grouped.map((g) => (
                  <div key={g.title} className="mt-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{g.title}</p>
                    <ul>
                      {g.items.map((r) => (
                        <li key={r.href}>
                          <button
                            type="button"
                            data-testid="link-result"
                            onClick={() => choose(r.href, r)}
                            className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-sm hover:bg-gray-50 ${
                              r.href === href ? 'bg-brand-50' : ''
                            }`}
                          >
                            <span className="truncate">{r.label}</span>
                            {r.detail && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">{r.detail}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-gray-600" htmlFor={`${id}-custom`}>
              Web address
            </label>
            <input
              id={`${id}-custom`}
              autoFocus
              type="url"
              inputMode="url"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setCustomError(e.target.value.trim() ? validateHref(normalizeHref(e.target.value), { allowEmpty: false, allowInternal, allowExternal }) : null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyCustom();
                }
              }}
              placeholder="https://"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            {customError && <p className="mt-1 text-xs font-medium text-red-600">{customError}</p>}
            <p className="mt-1 text-xs text-gray-400">For example a Facebook page or a map link. It opens in a new tab.</p>
            <button
              type="button"
              onClick={applyCustom}
              className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"
            >
              Use this address
            </button>
          </div>
        )}

        {allowEmpty && (
          <button
            type="button"
            onClick={() => choose('', null)}
            className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            No link
          </button>
        )}
      </Popover>
    </div>
  );
}
