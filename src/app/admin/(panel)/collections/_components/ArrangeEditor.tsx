'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { saveCollectionIndexAction } from '@/app/admin/actions/collections';
import { Notice } from '@/components/admin/ui';
import { SortableList } from '@/components/admin/SortableList';
import { StickySaveBar } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { CloseIcon, SearchIcon } from '@/components/admin/icons';

export type ArrangeCard = {
  key: string;
  id: number | null;
  collectionId: number | null;
  systemHandle: string | null;
  title: string;
  image: string | null;
  placeholder: number;
};

type Candidate = { id: number; title: string; image: string | null };

const snapshot = (cards: ArrangeCard[]) =>
  JSON.stringify(cards.map((c) => [c.id, c.collectionId, c.systemHandle ? [c.title, c.image] : null]));

const small =
  'inline-flex min-h-10 items-center rounded-lg px-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40';

function Thumb({ card }: { card: ArrangeCard }) {
  const src = card.image ?? `/images/catalog/collection-placeholder-${Math.min(6, Math.max(1, card.placeholder))}.svg`;
  return (
    <div className="h-14 w-11 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
}

/** Drag/arrow ordering of the /collections page cards, add collections, remove cards, edit built-in cards. */
export function ArrangeEditor({ initialCards, candidates }: { initialCards: ArrangeCard[]; candidates: Candidate[] }) {
  const [cards, setCards] = useState(initialCards);
  const [baseline, setBaseline] = useState(() => snapshot(initialCards));
  const [baseCards, setBaseCards] = useState(initialCards);
  const [removing, setRemoving] = useState<ArrangeCard | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [find, setFind] = useState('');
  const [highlight, setHighlight] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const dirty = snapshot(cards) !== baseline;

  // fresh server data after a save: adopt it (new cards get their ids)
  const initialKey = snapshot(initialCards);
  useEffect(() => {
    if (dirty) return;
    setCards(initialCards);
    setBaseCards(initialCards);
    setBaseline(initialKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey]);

  // every collection that can be added: not on the page right now
  const available = useMemo(() => {
    const all = new Map<number, Candidate>();
    for (const c of candidates) all.set(c.id, c);
    for (const c of baseCards) if (c.collectionId != null) all.set(c.collectionId, { id: c.collectionId, title: c.title, image: c.image });
    const used = new Set(cards.map((c) => c.collectionId).filter((n): n is number => n != null));
    return [...all.values()].filter((c) => !used.has(c.id)).sort((a, b) => a.title.localeCompare(b.title));
  }, [candidates, baseCards, cards]);

  const q = query.trim().toLowerCase();
  const matches = available.filter((c) => !q || c.title.toLowerCase().includes(q));

  const edit = (next: ArrangeCard[]) => {
    setCards(next);
    setFlash(null);
    setError(null);
  };
  const moveTo = (index: number, to: number) => {
    const next = [...cards];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    edit(next);
  };

  const f = find.trim().toLowerCase();
  const found = f ? cards.map((c, index) => ({ c, index })).filter(({ c }) => (c.title || 'Untitled').toLowerCase().includes(f)) : [];
  const moveKey = (key: string, to: 'top' | 'bottom') => {
    const index = cards.findIndex((c) => c.key === key);
    if (index >= 0) moveTo(index, to === 'top' ? 0 : cards.length - 1);
  };
  const show = (key: string) => {
    setHighlight(key);
    document.querySelector(`[data-card-key="${CSS.escape(key)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => setHighlight((h) => (h === key ? null : h)), 2500);
  };

  const addPicked = () => {
    const add = available
      .filter((c) => picked.includes(c.id))
      .map((c): ArrangeCard => ({ key: `n${c.id}`, id: null, collectionId: c.id, systemHandle: null, title: c.title, image: c.image, placeholder: ((cards.length % 6) + 1) }));
    edit([...cards, ...add]);
    setPicked([]);
    setQuery('');
    setAdding(false);
    if (add.length) setFlash(`${add.length} added at the end. Save to show ${add.length === 1 ? 'it' : 'them'} on the store.`);
  };

  const save = () =>
    startSaving(async () => {
      setError(null);
      const res = await saveCollectionIndexAction({
        cards: cards.map((c) => ({
          id: c.id,
          collectionId: c.collectionId,
          systemHandle: c.systemHandle,
          ...(c.systemHandle ? { systemTitle: c.title, systemImage: c.image } : {}),
        })),
      });
      if (res.ok) {
        setBaseline(snapshot(cards));
        setBaseCards(cards);
        setFlash('Saved. The Collections page is updated.');
      } else setError(res.error ?? 'Could not save.');
    });

  return (
    <div className="space-y-4">
      {flash && <Notice tone="success">{flash}</Notice>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"
        >
          + Add collections
        </button>
        <span className="text-xs text-gray-500">
          {cards.length} cards. Drag them, or use the arrows. The first cards show at the top of the page.
        </span>
      </div>

      {/* find a card in the long list: jump to it, or move it straight to the top or bottom (handy on phones) */}
      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-gray-400" />
          <input
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Find a card on the page…"
            aria-label="Find a card on the page"
            className="min-h-10 w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>
        {f && (
          <ul className="mt-2 divide-y divide-gray-100" data-testid="arrange-find-results">
            {found.length === 0 && <li className="py-3 text-center text-sm text-gray-500">No card matches.</li>}
            {found.slice(0, 8).map(({ c, index }) => (
              <li key={c.key} className="flex flex-wrap items-center gap-1 py-1.5">
                <span className="w-9 shrink-0 text-xs font-semibold text-gray-400">#{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink-dark">{c.title || 'Untitled'}</span>
                <span className="flex shrink-0 items-center">
                  <button type="button" className={small} onClick={() => show(c.key)}>
                    Show
                  </button>
                  <button type="button" className={small} disabled={index === 0} onClick={() => moveKey(c.key, 'top')}>
                    To top
                  </button>
                  <button type="button" className={small} disabled={index === cards.length - 1} onClick={() => moveKey(c.key, 'bottom')}>
                    To bottom
                  </button>
                </span>
              </li>
            ))}
            {found.length > 8 && <li className="py-2 text-xs text-gray-500">{found.length - 8} more. Type more of the name to narrow it down.</li>}
          </ul>
        )}
      </div>

      {adding && (
        <div className="rounded-xl border-2 border-brand-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-heading text-base font-bold text-ink-dark">Add collections to the page</h2>
            <button type="button" onClick={() => setAdding(false)} aria-label="Close" className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mb-2">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search collections…"
              aria-label="Search collections to add"
              className="min-h-10 w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200">
            {matches.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-gray-500">{available.length ? 'Nothing matches your search.' : 'Every collection is already on the page.'}</p>
            )}
            {matches.slice(0, 200).map((c) => (
              <label key={c.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={picked.includes(c.id)}
                  onChange={() => setPicked((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                  className="h-5 w-5 accent-brand"
                />
                <span className="min-w-0 truncate">{c.title}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={addPicked}
              disabled={!picked.length}
              className="inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Add {picked.length || ''} to the page
            </button>
          </div>
        </div>
      )}

      <SortableList
        items={cards}
        getKey={(c) => c.key}
        onReorder={edit}
        ariaLabel="Collections page cards"
        renderItem={(card, ctl) => {
          const builtIn = !!card.systemHandle;
          const open = editingKey === card.key;
          return (
            <div
              data-testid="index-card"
              data-card-key={card.key}
              className={`rounded-xl border bg-white shadow-sm transition ${highlight === card.key ? 'border-brand ring-2 ring-brand/30' : 'border-gray-200'}`}
            >
              <div className="flex items-center gap-1.5 p-1.5 pr-1 sm:gap-2 sm:pr-2">
                {ctl.handle}
                <span className="hidden w-8 shrink-0 text-center text-xs font-semibold text-gray-400 sm:inline">{ctl.index + 1}</span>
                <Thumb card={card} />
                <div className="min-w-0 flex-1 px-1">
                  <p className="truncate text-sm font-semibold text-ink-dark">{card.title || 'Untitled'}</p>
                  <p className="text-xs text-gray-500">
                    <span className="sm:hidden">#{ctl.index + 1} · </span>
                    {builtIn ? 'Built-in: all products' : 'Collection'}
                  </p>
                  <span className="-ml-2.5 flex md:hidden">
                    <button type="button" className={small} disabled={ctl.isFirst} onClick={() => moveTo(ctl.index, 0)}>
                      To top
                    </button>
                    <button type="button" className={small} disabled={ctl.isLast} onClick={() => moveTo(ctl.index, cards.length - 1)}>
                      To bottom
                    </button>
                  </span>
                  {builtIn && (
                    <button type="button" className={`${small} -ml-2.5 text-brand-700`} onClick={() => setEditingKey(open ? null : card.key)} aria-expanded={open}>
                      {open ? 'Done' : 'Edit title and photo'}
                    </button>
                  )}
                </div>
                <span className="hidden items-center md:inline-flex">
                  <button type="button" className={small} disabled={ctl.isFirst} onClick={() => moveTo(ctl.index, 0)}>
                    To top
                  </button>
                  <button type="button" className={small} disabled={ctl.isLast} onClick={() => moveTo(ctl.index, cards.length - 1)}>
                    To bottom
                  </button>
                </span>
                {ctl.arrows}
                <button
                  type="button"
                  onClick={() => setRemoving(card)}
                  disabled={builtIn}
                  title={builtIn ? 'Built-in card' : 'Remove from page'}
                  aria-label={`Remove “${card.title}” from page`}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </div>
              {builtIn && open && (
                <div className="grid gap-4 border-t border-gray-100 p-3 sm:grid-cols-[1fr_180px] sm:p-4">
                  <div>
                    <label htmlFor={`title-${card.key}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Card title
                    </label>
                    <input
                      id={`title-${card.key}`}
                      value={card.title}
                      maxLength={150}
                      onChange={(e) => edit(cards.map((c) => (c.key === card.key ? { ...c, title: e.target.value } : c)))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <p className="mt-1 text-xs text-gray-400">This card opens the list of all products.</p>
                  </div>
                  <ImageUpload
                    value={card.image}
                    onChange={(url) => edit(cards.map((c) => (c.key === card.key ? { ...c, image: url } : c)))}
                    label="Cover photo"
                    purpose="collection"
                    previewAspect="3 / 4"
                  />
                </div>
              )}
            </div>
          );
        }}
      />

      <ConfirmDialog
        open={removing != null}
        title={`Remove “${removing?.title ?? ''}” from the Collections page?`}
        consequences={['The collection itself is kept.']}
        confirmLabel="Remove from page"
        tone="danger"
        note="Removed when you save."
        onConfirm={() => {
          if (removing) edit(cards.filter((c) => c.key !== removing.key));
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />

      <UnsavedChangesGuard dirty={dirty && !saving} />
      <StickySaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        status="Order saved"
        actions={[
          ...(dirty ? [{ label: 'Undo changes', shortLabel: 'Undo', variant: 'secondary' as const, type: 'button' as const, onClick: () => edit(baseCards) }] : []),
          { label: 'Save order', type: 'button', onClick: save, disabled: !dirty },
        ]}
      />
    </div>
  );
}
