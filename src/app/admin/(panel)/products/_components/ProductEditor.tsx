'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckboxField, Field, FormError, Notice, SectionCard, Select, TextInput } from '@/components/admin/ui';
import { ImageGallery, newKey, type GalleryItem } from '@/components/admin/ImageGallery';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { toast, type ToastTone } from '@/components/toast/toast';
import { SAVE_ERROR_TOAST, StickySaveBar, type SaveBarAction } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { pendingUploadCount, WAITING_FOR_UPLOAD } from '@/components/admin/upload-client';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { CopyIcon } from '@/components/admin/icons';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { LayoutSummary } from '@/components/admin/LayoutSummary';
import { makeLayoutForProductAction } from '@/app/admin/actions/product-layouts';
import type { LayoutOption } from '../_lib/load';
import { slugify } from '@/lib/slug';
import { deleteProductAction, duplicateProductAction, saveProductAction } from '@/app/admin/actions/products';
import type { CollectionRow, ProductEditorState, SaveProductInput, VariantState } from '../_lib/types';
import { applyBulk, bulkMatches, sortByOptionOrder, type BulkFields, type BulkTarget, type GenResult, type Structure } from '../_lib/variants';
import { deleteBullets } from '../_lib/delete';
import { OptionsEditor } from './OptionsEditor';
import { VariantsTable } from './VariantsTable';
import { BulkEditBar } from './BulkEditBar';
import { CollectionsTree } from './CollectionsTree';
import { AdvancedSection } from './AdvancedSection';
import { PendingContext, type PendingEntry, type ReportPending } from './pending';
import { actionFailed } from '@/components/admin/action-failed';

type Problem = { message: string; field?: string; toast?: { tone: ToastTone; message: string } } | null;

/**
 * "Saved" notice that survives the remount a save causes (the server page keys the editor by updatedAt and
 * the save's revalidation re-renders it), without navigating — a late navigation could wipe fresh typing.
 */
const justSaved = new Set<number>();

const STATUS_PILL: Record<ProductEditorState['status'], { label: string; cls: string; text: string }> = {
  ACTIVE: {
    label: 'Published',
    cls: 'bg-emerald-100 text-emerald-800',
    text: 'Published — visible on the store',
  },
  DRAFT: {
    label: 'Draft',
    cls: 'bg-gray-100 text-gray-600',
    text: 'Draft — not visible on the store',
  },
  ARCHIVED: {
    label: 'Archived',
    cls: 'bg-gray-200 text-gray-600',
    text: 'Archived — not visible on the store',
  },
};

/** Everything a save compares; UI-only flags are left out so they never count as unsaved changes. */
function snapshot(s: ProductEditorState): string {
  const { handleTouched: _h, status: _s, updatedAt: _u, ...rest } = s;
  return JSON.stringify(rest);
}

/** Photo tags that point at a value that no longer exists become "Any option" (R4). */
function clearDanglingTags(images: GalleryItem[], s: Structure): GalleryItem[] {
  const keys = new Set(s.options.flatMap((o) => o.values.map((v) => v.key)));
  return images.some((im) => im.tagKey && !keys.has(im.tagKey))
    ? images.map((im) => (im.tagKey && !keys.has(im.tagKey) ? { ...im, tagKey: null } : im))
    : images;
}

/** Focus the input behind a server error: open a collapsed section, scroll, focus, highlight 3 s. */
function focusField(field: string) {
  const el =
    document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field)}"]`) ??
    document.querySelector<HTMLElement>(`[data-field="${CSS.escape(field.split('.').slice(0, 2).join('.'))}"]`);
  if (!el) return;
  const details = el.closest('details');
  if (details && !details.open) details.open = true;
  const row = el.closest<HTMLElement>('[data-testid="variant-row"]') ?? el;
  requestAnimationFrame(() => {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const input = el.matches('input,select,textarea,button') ? el : el.querySelector<HTMLElement>('input,select,textarea,button');
    input?.focus({ preventScroll: true });
    row.classList.add('ring-2', 'ring-red-400', 'ring-offset-2');
    window.setTimeout(() => row.classList.remove('ring-2', 'ring-red-400', 'ring-offset-2'), 3000);
  });
}

export function ProductEditor({
  initial,
  collections,
  productTypes,
  layouts,
  deleteInfo,
  notice,
}: {
  initial: ProductEditorState;
  collections: CollectionRow[];
  productTypes: string[];
  /** page layouts from the database (list order) */
  layouts: LayoutOption[];
  /** reviews + link warnings for the delete confirmation (null for a new product) */
  deleteInfo: { reviews: number; links: string[] } | null;
  notice?: 'saved' | 'duplicated' | null;
}) {
  const router = useRouter();
  const [state, setStateRaw] = useState(initial);
  const stateRef = useRef(initial);
  const setState = useCallback((next: ProductEditorState | ((s: ProductEditorState) => ProductEditorState)) => {
    const value = typeof next === 'function' ? next(stateRef.current) : next;
    stateRef.current = value;
    setStateRaw(value);
  }, []);
  const [baseline, setBaseline] = useState(() => snapshot(initial));
  // the layout the product has in the database ("Give this product its own layout" copies that one)
  const initialLayout = useRef(initial.layout);
  const [saved, setSaved] = useState(initial.handle);
  const [problem, setProblem] = useState<Problem>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [flash, setFlash] = useState<'saved' | 'duplicated' | null>(() => {
    if (initial.id != null && justSaved.has(initial.id)) return 'saved';
    return notice ?? null;
  });
  const [saving, startSaving] = useTransition();
  const [duplicating, setDuplicating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<BulkTarget>({ kind: 'all' });
  const bulkRef = useRef<HTMLInputElement>(null);
  // text typed into option boxes that isn't a value yet (see pending.ts)
  const pendingRef = useRef(new Map<string, PendingEntry>());
  const [pendingCount, setPendingCount] = useState(0);
  const reportPending = useCallback<ReportPending>((id, entry) => {
    if (entry) pendingRef.current.set(id, entry);
    else pendingRef.current.delete(id);
    setPendingCount(pendingRef.current.size);
    // the "Press Enter to add …" message goes away once that box is added or cleared
    if (!entry) setProblem((p) => (p?.field?.startsWith('pending.') && ![...pendingRef.current.values()].some((e) => e.field === p.field) ? null : p));
  }, []);

  const dirty = snapshot(state) !== baseline || pendingCount > 0;
  const isNew = state.id == null;
  const pill = STATUS_PILL[isNew ? 'DRAFT' : state.status];

  useEffect(() => {
    if (dirty && flash === 'saved') setFlash(null);
  }, [dirty, flash]);

  // an edit after a failed save clears the old message (the server checks again on the next save)
  const problemFor = useRef<ProductEditorState | null>(null);
  useEffect(() => {
    if (!problem) {
      problemFor.current = null; // cleared some other way (e.g. the option box was emptied): forget its state
      return;
    }
    if (stale) return;
    if (problemFor.current === null) problemFor.current = state;
    else if (problemFor.current !== state) {
      problemFor.current = null;
      setProblem(null);
    }
  }, [state, problem, stale]);

  const patch = useCallback((p: Partial<ProductEditorState>) => setState((s) => ({ ...s, ...p })), [setState]);

  const patchVariant = useCallback(
    (key: string, p: Partial<VariantState>) =>
      setState((s) => ({
        ...s,
        variants: s.variants.map((v) => (v.key === key ? { ...v, ...p } : v)),
      })),
    [setState],
  );

  const updateStructure = useCallback(
    (fn: (s: Structure) => GenResult | Structure): string | null => {
      const cur = stateRef.current;
      const r = fn({ options: cur.options, variants: cur.variants });
      if ('ok' in r && !r.ok) return r.error;
      const next = { options: r.options, variants: r.variants };
      setState({
        ...cur,
        ...next,
        images: clearDanglingTags(cur.images, next),
      });
      setSelected((sel) => {
        const keys = new Set(next.variants.map((v) => v.key));
        return [...sel].every((k) => keys.has(k)) ? sel : new Set([...sel].filter((k) => keys.has(k)));
      });
      return null;
    },
    [setState],
  );

  const fieldError = useCallback((field: string) => (problem?.field === field ? problem.message : null), [problem]);

  const tagOptions = useMemo(
    () =>
      state.options.flatMap((o) =>
        o.values.map((v) => ({
          key: v.key,
          label: `${o.name || 'Option'}: ${v.value}`,
        })),
      ),
    [state.options],
  );
  const taggedValueKeys = useMemo(() => new Set(state.images.map((i) => i.tagKey).filter((k): k is string => !!k)), [state.images]);

  const focusBulk = (target: BulkTarget) => {
    setBulkTarget(target);
    requestAnimationFrame(() => {
      bulkRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      bulkRef.current?.focus({ preventScroll: true });
    });
  };

  const save = (intent: 'draft' | 'publish', force = false) => {
    if (saving) return;
    // the photo would land in an editor the save has already replaced, and be lost
    if (pendingUploadCount() > 0) {
      setProblem({ message: WAITING_FOR_UPLOAD });
      return;
    }
    const pending = pendingRef.current.values().next().value;
    if (pending) {
      setProblem({ message: pending.message, field: pending.field });
      focusField(pending.field);
      toast.error(SAVE_ERROR_TOAST);
      return;
    }
    const cur = stateRef.current;
    const { handleTouched: _h, status: _s, ...rest } = cur;
    const input: SaveProductInput = {
      ...rest,
      handle: cur.handleTouched ? cur.handle : slugify(cur.title),
      intent,
      ...(force && stale ? { force: true, updatedAt: stale } : {}),
    };
    setProblem(null);
    startSaving(async () => {
      const res = await saveProductAction(input);
      if (!res.ok) {
        if (res.code === 'STALE') {
          setStale(res.currentUpdatedAt);
          setProblem({ message: res.error });
          return;
        }
        if (res.code === 'RELOAD') {
          setProblem({ message: res.error, toast: { tone: 'warning', message: 'Saved. Refresh the page to see it.' } });
          return;
        }
        setProblem({ message: res.error, field: res.field });
        if (res.field) focusField(res.field);
        return;
      }
      setStale(null);
      // remap selection through the returned ids (keys are rebuilt by the loader)
      const idByKey = new Map(cur.variants.map((v) => [v.key, v.id]));
      setSelected(
        (sel) =>
          new Set(
            [...sel]
              .map((k) => idByKey.get(k))
              .filter((id): id is number => id != null)
              .map((id) => `var${id}`),
          ),
      );
      setState(res.state);
      setBaseline(snapshot(res.state));
      initialLayout.current = res.state.layout;
      setSaved(res.state.handle);
      setFlash('saved');
      toast.success(res.state.status === 'ACTIVE' ? (isNew ? 'Product added to the store' : 'Product saved') : isNew ? 'Draft product added' : 'Draft saved');
      const savedId = res.state.id;
      if (savedId != null) {
        justSaved.add(savedId);
        window.setTimeout(() => justSaved.delete(savedId), 3000);
      }
      // a new product moves to its own page (which remounts the editor from fresh server props)
      if (isNew)
        router.replace(`/admin/products/${res.state.id}?saved=1`, {
          scroll: false,
        });
    });
  };

  const duplicate = async () => {
    if (state.id == null) return;
    if ((dirty || pendingUploadCount() > 0) && !window.confirm('Your unsaved changes are not copied. Duplicate the saved product anyway?')) return;
    setDuplicating(true);
    const res = await duplicateProductAction(state.id).catch(actionFailed);
    setDuplicating(false);
    if (!res.ok) {
      setProblem({ message: res.error });
      toast.error('Copy not made');
      return;
    }
    setBaseline(snapshot(stateRef.current)); // leaving on purpose
    router.push(`/admin/products/${res.id}?duplicated=1`);
  };

  const published = !isNew && state.status === 'ACTIVE';
  const actions: SaveBarAction[] = stale
    ? [
        {
          label: 'Reload latest (lose my changes)',
          shortLabel: 'Reload',
          variant: 'secondary',
          type: 'button',
          onClick: () => {
            setStale(null);
            setProblem(null);
            setBaseline(snapshot(stateRef.current));
            router.refresh();
          },
        },
        {
          label: 'Save mine anyway',
          shortLabel: 'Save mine',
          type: 'button',
          onClick: () => save(published ? 'publish' : 'draft', true),
        },
      ]
    : published
      ? [
          {
            label: 'Unpublish (save as draft)',
            shortLabel: 'Unpublish',
            variant: 'secondary',
            type: 'button',
            onClick: () => save('draft'),
          },
          { label: 'Save', type: 'button', onClick: () => save('publish') },
        ]
      : [
          {
            label: 'Save as draft',
            shortLabel: 'Draft',
            variant: 'secondary',
            type: 'button',
            onClick: () => save('draft'),
          },
          { label: 'Publish', type: 'button', onClick: () => save('publish') },
        ];

  return (
    <div className="pb-28">
      <UnsavedChangesGuard dirty={dirty && !saving} />

      {/* header */}
      <div className="mb-5">
        <Link href="/admin/products" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-600 hover:underline">
          ← Products
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words font-heading text-xl font-bold text-ink-dark">{isNew ? 'New product' : state.title || 'Untitled product'}</h1>
            <span data-testid="product-status" className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${pill.cls}`}>
              {isNew ? 'Not saved yet' : pill.label}
            </span>
          </div>
          {!isNew && (
            <div className="flex flex-wrap items-center gap-2">
              <ViewOnStoreLink href={published ? `/products/${saved}` : null} disabledReason="Publish to see it on the store" />
              <button
                type="button"
                onClick={duplicate}
                disabled={duplicating}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 text-xs font-semibold text-ink-dark hover:border-brand-400 disabled:opacity-50"
              >
                <CopyIcon className="h-3.5 w-3.5" />
                {duplicating ? 'Duplicating…' : 'Duplicate'}
              </button>
              <ConfirmDelete
                action={deleteProductAction}
                fields={{ id: String(state.id) }}
                title={`Delete “${state.title}”?`}
                consequences={deleteBullets({
                  combinations: state.variants.length,
                  photos: state.images.length,
                  reviews: deleteInfo?.reviews ?? 0,
                  links: deleteInfo?.links ?? [],
                })}
              />
            </div>
          )}
        </div>
      </div>

      <PendingContext.Provider value={reportPending}>
        {/* locked while saving: the save replaces the whole form with the saved version, so typing now would be lost */}
        <fieldset disabled={saving} aria-busy={saving} className="min-w-0 space-y-5">
          {flash === 'saved' && (
            <Notice tone="success">{published ? 'Saved. The store is updated.' : 'Saved as a draft. It is not on the store.'}</Notice>
          )}
          {flash === 'duplicated' && <Notice tone="info">This is a copy. It is a draft until you publish it.</Notice>}

          <SectionCard id="basics" title="Basics">
            <div className="grid gap-4">
              <Field label="Title" htmlFor="product-title">
                <TextInput
                  id="product-title"
                  data-field="title"
                  value={state.title}
                  maxLength={200}
                  showCount
                  onChange={(e) => {
                    const title = e.target.value;
                    patch(stateRef.current.handleTouched ? { title } : { title, handle: slugify(title) });
                  }}
                  placeholder="e.g. Alexa Sofa Chair"
                  className={fieldError('title') ? 'border-red-400' : ''}
                />
                <FormError message={fieldError('title')} />
              </Field>
              <Field
                label="Delivery time (optional)"
                htmlFor="product-delivery"
                hint="Example: Delivered in 20 to 30 working days. Filling this in also shows a red FREE DELIVERY! tag under the price, so leave it empty if delivery is not free."
              >
                <TextInput
                  id="product-delivery"
                  data-field="deliveryTime"
                  value={state.deliveryTime}
                  maxLength={200}
                  onChange={(e) => patch({ deliveryTime: e.target.value })}
                />
                <FormError message={fieldError('deliveryTime')} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            id="photos"
            title="Photos"
            description="The first photo is the main photo. Use “Shows” to switch the gallery when a customer picks that option. JPG, PNG, WebP or iPhone photos up to 20 MB."
          >
            <ImageGallery
              items={state.images}
              onChange={(images) => patch({ images })}
              tagOptions={tagOptions.length ? tagOptions : undefined}
              purpose="product"
            />
            {(() => {
              const bad = state.images.find((im) => fieldError(`images.${im.key}.alt`));
              return bad ? <FormError message={fieldError(`images.${bad.key}.alt`)} /> : null;
            })()}
          </SectionCard>

          <SectionCard id="description" title="Description" description="Shown under the price. Use Heading for “Specifications:”-style titles.">
            <div data-field="bodyHtml">
              <RichTextEditor
                readOnly={saving}
                value={state.bodyHtml}
                onChange={(bodyHtml) => patch({ bodyHtml })}
                ariaLabel="Description"
                placeholder="Describe the product: materials, sizes, care…"
              />
            </div>
          </SectionCard>

          <SectionCard
            id="options"
            title="Options & prices"
            description="Prices are in rupees. Sale price is the reduced price customers pay; the regular price is shown struck through."
          >
            <div className="space-y-5">
              <OptionsEditor
                structure={{ options: state.options, variants: state.variants }}
                update={updateStructure}
                taggedValueKeys={taggedValueKeys}
                onApplyTo={(valueKey) => focusBulk({ kind: 'value', valueKey })}
                fieldError={fieldError}
              />
              {state.options.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => focusBulk({ kind: 'all' })}
                      className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Set all prices
                    </button>
                  </div>
                  <BulkEditBar
                    ref={bulkRef}
                    options={state.options}
                    selectedCount={selected.size}
                    target={bulkTarget}
                    onTarget={setBulkTarget}
                    onApply={(f: BulkFields) => {
                      const cur = stateRef.current;
                      const n = cur.variants.filter((v) => bulkMatches(v, bulkTarget, selected)).length;
                      setState({
                        ...cur,
                        variants: applyBulk(cur.variants, bulkTarget, selected, f),
                      });
                      return n;
                    }}
                  />
                </>
              )}
              <VariantsTable
                options={state.options}
                variants={state.variants}
                trackStock={state.trackStock}
                selected={selected}
                onToggleSelect={(k) =>
                  setSelected((sel) => {
                    const next = new Set(sel);
                    if (next.has(k)) next.delete(k);
                    else next.add(k);
                    return next;
                  })
                }
                onToggleAll={(on) => setSelected(on ? new Set(state.variants.map((v) => v.key)) : new Set())}
                onPatch={patchVariant}
                onReorder={(variants) => patch({ variants })}
                onSortByOptionOrder={() => updateStructure(sortByOptionOrder)}
                fieldError={fieldError}
              />
            </div>
          </SectionCard>

          <SectionCard id="collections" title="Collections" description="The product appears on these collection pages.">
            <CollectionsTree rows={collections} value={state.collectionIds} onChange={(collectionIds) => patch({ collectionIds })} />
          </SectionCard>

          <SectionCard id="visibility" title="Visibility">
            <div className="space-y-1">
              <p className="mb-2 text-sm text-gray-600">
                Status: <span className="font-semibold text-ink-dark">{isNew ? 'Not saved yet' : pill.text}</span>. Use the buttons at the bottom to publish or
                unpublish.
              </p>
              <CheckboxField
                label="Best seller"
                hint="Puts the product in Hot Selling Products on the home page once published (up to 24 best sellers, most recently changed first) and lists it first when sorting by best selling."
                checked={state.hot}
                onChange={(hot) => patch({ hot })}
              />
              <CheckboxField
                label="New arrival"
                hint="Red NEW label on the product and its card."
                checked={state.isNew}
                onChange={(isNew) => patch({ isNew })}
              />
              <CheckboxField
                label="Limited edition"
                hint="Yellow label on product cards."
                checked={state.limitedEdition}
                onChange={(limitedEdition) => patch({ limitedEdition })}
              />
              <div className="pt-3">
                <Field label="Page layout" htmlFor="product-layout" hint="Sections shown below the product.">
                  <Select
                    id="product-layout"
                    data-field="layout"
                    value={state.layout}
                    onChange={(e) => patch({ layout: e.target.value })}
                    className={fieldError('layout') ? 'border-red-400' : ''}
                  >
                    {layouts.map((l) => (
                      <option key={l.key} value={l.key}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <FormError message={fieldError('layout')} />
                <LayoutHelp
                  layout={layouts.find((l) => l.key === state.layout)}
                  savedLayout={isNew ? null : initialLayout.current}
                  productId={state.id}
                  dirty={dirty}
                  productTitle={state.title}
                />
              </div>
            </div>
          </SectionCard>

          <AdvancedSection
            state={state}
            savedHandle={isNew ? null : saved}
            productTypes={productTypes}
            onChange={patch}
            onPatchVariant={patchVariant}
            fieldError={fieldError}
          />
        </fieldset>
      </PendingContext.Provider>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        status={isNew ? 'New product — not saved yet' : pill.text}
        error={problem?.message ?? null}
        errorToast={problem?.toast}
        actions={actions}
      />
    </div>
  );
}

/**
 * Under the "Page layout" dropdown: the layout's live contents, what it's for and how many products use it, a link
 * to edit it, and "Give this product its own layout" (SPEC product-layouts §11).
 */
function LayoutHelp({
  layout,
  savedLayout,
  productId,
  dirty,
  productTitle,
}: {
  layout: LayoutOption | undefined;
  /** the layout key the product has in the database (null for a new product) */
  savedLayout: string | null;
  productId: number | null;
  dirty: boolean;
  productTitle: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!layout) return null;
  const used = layout.usedBy === 0 ? 'Not used by any product yet' : `Used by ${layout.usedBy} product${layout.usedBy === 1 ? '' : 's'}`;
  const canOwn = productId != null && savedLayout === layout.key && layout.usedBy >= 2;
  const makeOwn = async () => {
    if (productId == null) return;
    setBusy(true);
    setError(null);
    const res = await makeLayoutForProductAction({ productId }).catch(actionFailed);
    if (!res.ok) {
      setBusy(false);
      setConfirm(false);
      setError(res.error);
      toast.error('Own layout not made');
      return;
    }
    router.push(`/admin/product-layouts/${res.id}?own=1`);
  };
  return (
    <div className="mt-1.5 space-y-1.5" data-testid="layout-help">
      <LayoutSummary summary={layout.summary} compact />
      <p className="text-xs text-gray-600">
        {layout.description ? `${layout.description} · ` : ''}
        {used}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/admin/product-layouts/${layout.id}`} className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-700 hover:underline">
          Edit this layout ↗{layout.usedBy >= 2 ? ` (changes ${layout.usedBy} products)` : ''}
        </Link>
        {canOwn && (
          <button
            type="button"
            onClick={() => setConfirm(true)}
            disabled={dirty || busy}
            title={dirty ? 'Save the product first' : undefined}
            className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Give this product its own layout
          </button>
        )}
        {canOwn && dirty && <span className="text-xs text-gray-500">Save the product first</span>}
      </div>
      {error && <FormError message={error} />}
      <ConfirmDialog
        open={confirm}
        title={`Make a copy of “${layout.name}” just for this product?`}
        consequences={[`“${productTitle || 'This product'}” gets its own copy to change freely`, 'Other products keep the current layout']}
        confirmLabel={busy ? 'Making the copy…' : 'Make the copy'}
        onConfirm={makeOwn}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
