'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, dialogButton } from '@/components/admin/Dialog';
import { CollectionPicker, type PickedCollection } from '@/components/admin/CollectionPicker';
import { ProductChecklist } from '@/components/admin/ProductChecklist';
import { LayoutSummary } from '@/components/admin/LayoutSummary';
import { Select } from '@/components/admin/ui';
import { moveProductsAction, searchProductsForMoveAction, undoMoveProductsAction, type MoveResult } from '@/app/admin/actions/product-layouts';
import { productsPhrase } from '@/lib/product-layout-draft';
import type { LayoutChoice } from '../_lib/load';
import { toast } from '@/components/toast/toast';
import { useToastClearance } from '@/components/toast/useToastClearance';

export type MoveDone = Extract<MoveResult, { ok: true }>;

/**
 * "Move products" between two layouts (SPEC §10): all of them, only those in a collection, or hand-picked ones.
 * The server re-reads the matching products and reports the real number.
 */
export function MoveProductsDialog({
  open,
  onClose,
  layouts,
  fromId: initialFrom,
  toId: initialTo,
  title,
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  layouts: LayoutChoice[];
  fromId: number | null;
  toId: number | null;
  title: string;
  onMoved: (r: MoveDone) => void;
}) {
  const [fromId, setFromId] = useState<number | null>(initialFrom);
  const [toId, setToId] = useState<number | null>(initialTo);
  const [scope, setScope] = useState<'all' | 'collection' | 'chosen'>('all');
  const [collection, setCollection] = useState<PickedCollection | null>(null);
  const [inCollection, setInCollection] = useState<number | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    setFromId(initialFrom);
    setToId(initialTo);
    setScope('all');
    setCollection(null);
    setChosen(new Set());
    setError(null);
  }, [open, initialFrom, initialTo]);

  useEffect(() => {
    setInCollection(null);
    if (!open || scope !== 'collection' || !collection || !fromId) return;
    let cancelled = false;
    searchProductsForMoveAction({ layoutId: fromId, collectionId: collection.id, take: 0 })
      .then((r) => !cancelled && setInCollection(r.total))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, scope, collection, fromId]);

  const from = layouts.find((l) => l.id === fromId) ?? null;
  const to = layouts.find((l) => l.id === toId) ?? null;
  const count = scope === 'all' ? (from?.usedBy ?? 0) : scope === 'collection' ? (inCollection ?? 0) : chosen.size;
  const ready = !!from && !!to && from.id !== to.id && count > 0;

  const submit = async () => {
    if (!from || !to) {
      setError('Please choose the layout to move them to.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await moveProductsAction({ fromId: from.id, toId: to.id, scope, collectionId: collection?.id ?? null, productIds: [...chosen] });
      if (!res.ok) {
        setError(res.error);
        toast.error('Products not moved');
      } else onMoved(res);
    } catch {
      setError('The products could not be moved. Please try again.');
      toast.error('Products not moved');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      fullOnPhone
      width="max-w-xl"
      testId="move-products-dialog"
      footer={
        <>
          <button type="button" onClick={onClose} className={dialogButton.secondary}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!ready || busy} className={dialogButton.primary}>
            {busy ? 'Moving…' : `Move ${productsPhrase(count)}`}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div>
          <label htmlFor={`${id}-from`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            From
          </label>
          <Select
            id={`${id}-from`}
            value={fromId ?? ''}
            onChange={(e) => {
              const v = Number(e.target.value) || null;
              setFromId(v);
              if (v === toId) setToId(null);
              setChosen(new Set());
            }}
          >
            <option value="">Choose a layout</option>
            {layouts.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {productsPhrase(l.usedBy)}
              </option>
            ))}
          </Select>
          {from && (
            <div className="mt-1.5">
              <LayoutSummary summary={from.summary} compact />
            </div>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-to`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            To
          </label>
          <Select id={`${id}-to`} value={toId ?? ''} onChange={(e) => setToId(Number(e.target.value) || null)}>
            <option value="">Choose a layout</option>
            {layouts
              .filter((l) => l.id !== fromId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </Select>
          {to && (
            <div className="mt-1.5">
              <LayoutSummary summary={to.summary} compact />
            </div>
          )}
        </div>

        <fieldset className="grid gap-2" disabled={!from}>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Which products</legend>
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name={`${id}-scope`} checked={scope === 'all'} onChange={() => setScope('all')} className="h-5 w-5" />
            All {productsPhrase(from?.usedBy ?? 0)}
          </label>
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name={`${id}-scope`} checked={scope === 'collection'} onChange={() => setScope('collection')} className="h-5 w-5" />
            Only products in a collection
          </label>
          {scope === 'collection' && (
            <div className="ml-8 grid gap-1">
              <CollectionPicker label="Collection" value={collection} onChange={setCollection} />
              {collection && (
                <p className="text-xs text-gray-600" aria-live="polite">
                  {inCollection == null ? 'Counting…' : `${productsPhrase(inCollection)} of this layout ${inCollection === 1 ? 'is' : 'are'} in “${collection.title}”.`}
                </p>
              )}
            </div>
          )}
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
            <input type="radio" name={`${id}-scope`} checked={scope === 'chosen'} onChange={() => setScope('chosen')} className="h-5 w-5" />
            Choose products
          </label>
          {scope === 'chosen' && from && (
            <div className="sm:ml-8">
              <ProductChecklist layoutId={from.id} selected={chosen} onChange={setChosen} />
            </div>
          )}
        </fieldset>
        {from && from.usedBy === 0 && <p className="text-sm text-gray-600">No product uses “{from.name}” yet.</p>}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  );
}

/** "Moved 12 products · Undo" (fixed at the bottom, above the save bar). */
export function MoveToast({ done, onClose }: { done: MoveDone | null; onClose: () => void }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'undoing' | 'undone' | 'error'>('idle');
  const barRef = useRef<HTMLDivElement>(null);
  // this bar is a toast of its own (with Undo): other toasts stack above it
  useToastClearance(barRef, !!done);
  useEffect(() => setState('idle'), [done]);
  useEffect(() => {
    if (!done || state === 'undoing') return;
    const t = window.setTimeout(onClose, state === 'idle' ? 15000 : 4000);
    return () => window.clearTimeout(t);
  }, [done, state, onClose]);
  if (!done) return null;
  const undo = async () => {
    setState('undoing');
    try {
      const r = await undoMoveProductsAction({ movedIds: done.movedIds, fromKey: done.fromKey, toKey: done.toKey });
      setState(r.ok ? 'undone' : 'error');
      router.refresh();
    } catch {
      setState('error');
    }
  };
  return (
    <div ref={barRef} role="status" data-testid="move-toast" className="fixed inset-x-4 bottom-28 z-40 mx-auto flex max-w-md flex-wrap items-center justify-between gap-2 rounded-xl bg-ink-dark px-4 py-3 text-sm text-white shadow-xl lg:left-64">
      <span>
        {state === 'undone'
          ? 'Moved back.'
          : state === 'error'
            ? 'Could not undo. Please move them back by hand.'
            : `Moved ${productsPhrase(done.count)} to “${done.toName}”`}
      </span>
      <span className="flex items-center gap-1">
        {state === 'idle' && done.count > 0 && (
          <button type="button" onClick={undo} className="inline-flex min-h-10 items-center rounded-lg px-3 font-semibold text-brand-200 hover:bg-white/10">
            Undo
          </button>
        )}
        {state === 'undoing' && <span className="px-3 text-white/70">Undoing…</span>}
        <button type="button" onClick={onClose} aria-label="Close" className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg hover:bg-white/10">
          ×
        </button>
      </span>
    </div>
  );
}
