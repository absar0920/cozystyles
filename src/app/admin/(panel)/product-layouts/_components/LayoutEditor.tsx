'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { Notice, TextInput, ToggleSwitch } from '@/components/admin/ui';
import { SortableList } from '@/components/admin/SortableList';
import { toast } from '@/components/toast/toast';
import { StickySaveBar, type SaveBarAction } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Dialog, dialogButton } from '@/components/admin/Dialog';
import { MenuButton } from '@/components/admin/MenuButton';
import { pendingUploadCount, WAITING_FOR_UPLOAD } from '@/components/admin/upload-client';
import { ExternalLinkIcon, PlusIcon } from '@/components/admin/icons';
import {
  MAX_FEATURED_PER_LAYOUT,
  MAX_SECTIONS,
  ADDABLE_KINDS,
  SECTION_KIND_COPY,
  SINGLETON_KINDS,
  newSectionDefaults,
  type SectionKind,
} from '@/lib/product-layout-sections';
import {
  MAX_DESCRIPTION,
  describeChanges,
  isAutomaticKind,
  preferredImageTextHeading,
  productsPhrase,
  sectionLabels,
  sectionSummaryText,
  sectionThumb,
  sectionWarnings,
  valuesFromData,
  type DraftSection,
  type DraftValues,
  type LayoutDraft,
  type SectionErrors,
} from '@/lib/product-layout-draft';
import { MAX_LAYOUT_NAME, copyName, layoutNameKey } from '@/lib/product-layouts';
import {
  createLayoutPreviewAction,
  deleteProductLayoutAction,
  duplicateProductLayoutAction,
  saveAsNewLayoutAction,
  saveProductLayoutAction,
  searchProductsForMoveAction,
  type MoveCandidate,
} from '@/app/admin/actions/product-layouts';
import type { LayoutEditorData } from '../_lib/load';
import { MoveProductsDialog, MoveToast, type MoveDone } from './MoveProducts';
import { OverlayEditor } from './sections/OverlayEditor';
import { ImageTextEditor } from './sections/ImageTextEditor';
import { IconsEditor } from './sections/IconsEditor';
import { TestimonialsEditor } from './sections/TestimonialsEditor';
import { SlideshowEditor } from './sections/SlideshowEditor';
import { FeaturedEditor } from './sections/FeaturedEditor';
import { AutomaticEditor, KindDiagram } from './sections/AutomaticEditor';
import type { SectionEditorProps } from './sections/common';
import { actionFailed } from '@/components/admin/action-failed';

type MoveState = { fromId: number | null; toId: number | null; title: string } | null;

const NARROW = '(max-width: 639px)';
const same = (a: LayoutDraft, b: LayoutDraft) => JSON.stringify(a) === JSON.stringify(b);
const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Plain text of a section's rich text, for its summary row. */
function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Loaded versions ("Undo last save", "Restore the original design") reuse the client keys of the editor's saved
 * sections of the same kind, in order, so the change list says "Edited: Photo and text 2" rather than
 * "Removed … Added …".
 */
function adoptKeys(loaded: LayoutDraft, saved: LayoutDraft): LayoutDraft {
  const free = new Map<SectionKind, string[]>();
  for (const s of saved.sections) free.set(s.kind, [...(free.get(s.kind) ?? []), s.key]);
  return {
    ...loaded,
    sections: loaded.sections.map((s) => {
      const k = free.get(s.kind)?.shift();
      return { ...s, key: k ?? newKey() };
    }),
  };
}

/**
 * Where "Add section" puts a new section: above the automatic sections at the end of the layout ("You may also
 * like", reviews), which normally close the product page, so the owner doesn't have to move it up each time.
 * An automatic section itself is added at the very end.
 */
function insertAt(sections: readonly DraftSection[], kind: SectionKind): number {
  if (isAutomaticKind(kind)) return sections.length;
  let at = sections.length;
  while (at > 0 && isAutomaticKind(sections[at - 1].kind)) at--;
  return at;
}

function SubmitDeleteButton({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? 'Deleting…' : 'Delete permanently'}
    </button>
  );
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `today ${time}`;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `yesterday ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

export function LayoutEditor({
  data: initial,
  flash: initialFlash,
  openRename,
  moveFromId,
  copiedFromId,
  serverError,
}: {
  data: LayoutEditorData;
  flash: 'copied' | 'created' | 'own' | null;
  openRename: boolean;
  /** open the Move dialog from this layout on load ("Save as a new layout instead") */
  moveFromId: number | null;
  /** this layout was just copied from that one ("Bring products here…" moves from it) */
  copiedFromId: number | null;
  serverError: 'in-use' | 'protected' | null;
}) {
  const router = useRouter();
  const [server, setServer] = useState(initial);
  const [draft, setDraftRaw] = useState<LayoutDraft>(initial.draft);
  const draftRef = useRef(initial.draft);
  const setDraft = useCallback((next: LayoutDraft | ((d: LayoutDraft) => LayoutDraft)) => {
    const v = typeof next === 'function' ? next(draftRef.current) : next;
    draftRef.current = v;
    setDraftRaw(v);
  }, []);
  const [baseline, setBaseline] = useState<LayoutDraft>(initial.draft);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [imageMeta, setImageMeta] = useState(initial.imageMeta);
  const [collections, setCollections] = useState(initial.collections);
  const [errors, setErrors] = useState<SectionErrors>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [nameError, setNameError] = useState<{ field: 'name' | 'description'; message: string } | null>(null);
  const [stale, setStale] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(
    initialFlash === 'copied'
      ? 'Copy made. Move products to it with “Bring products here…”.'
      : initialFlash === 'created'
        ? 'Layout created.'
        : initialFlash === 'own'
          ? 'This product now has its own layout. Changes here affect only that product.'
          : null,
  );
  const [renaming, setRenaming] = useState(openRename);
  const [warnOpen, setWarnOpen] = useState(false);
  const [saveAsNew, setSaveAsNew] = useState<{ name: string; error: string | null; busy: boolean } | null>(null);
  const [move, setMove] = useState<MoveState>(
    moveFromId ? { fromId: moveFromId, toId: initial.layout.id, title: `Bring products here from “${initial.layouts.find((l) => l.id === moveFromId)?.name ?? 'another layout'}”` } : null,
  );
  const [moveDone, setMoveDone] = useState<MoveDone | null>(null);
  const [replace, setReplace] = useState<'previous' | 'original' | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [deleteLayoutOpen, setDeleteLayoutOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [copying, setCopying] = useState(false);
  const narrow = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    narrow.current = mq.matches;
    const on = () => (narrow.current = mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // server refreshes (e.g. after moving products) bring new counts; the draft is left alone
  useEffect(() => {
    setServer((s) => (s === initial ? s : { ...initial, draft: s.draft }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const L = server.layout;
  const usedBy = L.usedBy;
  const dirty = !same(draft, baseline);
  const labels = useMemo(() => sectionLabels(draft.sections), [draft.sections]);
  const otherLayouts = server.layouts.filter((l) => l.id !== L.id);

  useEffect(() => {
    if (dirty && flash) setFlash(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  /* ----------------------------------------------------------------------------------------- sections */

  const patchSection = useCallback(
    (key: string, p: Partial<DraftSection>) => setDraft((d) => ({ ...d, sections: d.sections.map((s) => (s.key === key ? ({ ...s, ...p } as DraftSection) : s)) })),
    [setDraft],
  );

  const scrollTo = (key: string) =>
    requestAnimationFrame(() => document.querySelector(`[data-section-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));

  const toggleOpen = (key: string, force?: boolean) =>
    setOpen((o) => {
      const willOpen = force ?? !o.has(key);
      const next = narrow.current && willOpen ? new Set<string>() : new Set(o);
      if (willOpen) next.add(key);
      else next.delete(key);
      return next;
    });

  const addSection = (kind: SectionKind) => {
    const d = newSectionDefaults(kind, kind === 'imageText' ? { headingClass: preferredImageTextHeading(draftRef.current.sections) } : {});
    const s = { key: newKey(), kind, base: { from: 'new' }, hidden: false, bodyHtml: d.bodyHtml, values: valuesFromData(kind, d.data, null) } as DraftSection;
    setDraft((cur) => {
      const at = insertAt(cur.sections, kind);
      return { ...cur, sections: [...cur.sections.slice(0, at), s, ...cur.sections.slice(at)] };
    });
    setAddOpen(false);
    toggleOpen(s.key, true);
    window.setTimeout(() => scrollTo(s.key), 50);
  };

  const copySection = (key: string) => {
    const cur = draftRef.current;
    const i = cur.sections.findIndex((s) => s.key === key);
    if (i < 0) return;
    const src = cur.sections[i];
    const base = src.base.from === 'stored' ? { from: 'copy' as const, id: src.base.id } : src.base;
    const copy = { ...structuredClone(src), key: newKey(), base } as DraftSection;
    setDraft({ ...cur, sections: [...cur.sections.slice(0, i + 1), copy, ...cur.sections.slice(i + 1)] });
    window.setTimeout(() => scrollTo(copy.key), 50);
  };

  const removeSection = (key: string) => {
    setDraft((d) => ({ ...d, sections: d.sections.filter((s) => s.key !== key) }));
    setOpen((o) => {
      const n = new Set(o);
      n.delete(key);
      return n;
    });
  };

  const addImageMeta = useCallback((url: string, w: number, h: number) => setImageMeta((m) => ({ ...m, [url]: { w, h } })), []);
  const addCollection = useCallback((id: number, title: string, products: number) => setCollections((c) => ({ ...c, [id]: { title, products } })), []);

  /* --------------------------------------------------------------------------------------------- save */

  const afterSaved = (data: LayoutEditorData, ids: Record<string, number>) => {
    setServer(data);
    setImageMeta((m) => ({ ...m, ...data.imageMeta }));
    setCollections((c) => ({ ...c, ...data.collections }));
    setOpen((o) => new Set([...o].map((k) => (ids[k] != null ? `s-${ids[k]}` : k))));
    setDraft(data.draft);
    setBaseline(data.draft);
    setErrors({});
    setProblem(null);
    setNameError(null);
    setStale(false);
    setRenaming(false);
    const n = data.layout.usedBy;
    setFlash(n > 0 ? `Saved. ${n === 1 ? 'The product page is' : `${n} product pages are`} updated.` : 'Saved.');
    toast.success('Layout saved');
    router.refresh();
  };

  const showErrors = (res: { error: string; sectionErrors?: SectionErrors; field?: 'name' | 'description' }) => {
    setProblem(res.error);
    if (res.field) {
      setNameError({ field: res.field, message: res.error });
      setRenaming(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    if (res.sectionErrors) {
      const keys = Object.keys(res.sectionErrors);
      setErrors(res.sectionErrors);
      setOpen((o) => new Set([...(narrow.current ? [] : o), ...(narrow.current ? keys.slice(0, 1) : keys)]));
      const first = draftRef.current.sections.find((s) => keys.includes(s.key));
      if (first) window.setTimeout(() => scrollTo(first.key), 80);
    }
  };

  const doSave = async () => {
    setWarnOpen(false);
    if (pendingUploadCount() > 0) {
      setProblem(WAITING_FOR_UPLOAD);
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const res = await saveProductLayoutAction({ layoutId: L.id, updatedAt: L.updatedAt, draft: draftRef.current });
      if (res.ok) afterSaved(res.data, res.ids);
      else if (res.code === 'STALE') {
        setStale(true);
        setProblem('Someone else saved this layout a moment ago.');
      } else showErrors(res);
    } catch {
      setProblem('The layout could not be saved. Check your internet connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const save = () => {
    if (!dirty || saving) return;
    if (pendingUploadCount() > 0) {
      setProblem(WAITING_FOR_UPLOAD);
      return;
    }
    if (usedBy >= 2) setWarnOpen(true);
    else void doSave();
  };

  const openSaveAsNew = () => {
    setWarnOpen(false);
    const taken = new Set(server.layouts.map((l) => layoutNameKey(l.name)));
    setSaveAsNew({ name: copyName(draftRef.current.name || L.name, taken), error: null, busy: false });
  };

  const doSaveAsNew = async () => {
    if (!saveAsNew) return;
    if (pendingUploadCount() > 0) {
      setSaveAsNew({ ...saveAsNew, error: WAITING_FOR_UPLOAD });
      toast.info('Saving waits until the upload finishes');
      return;
    }
    setSaveAsNew({ ...saveAsNew, busy: true, error: null });
    try {
      const res = await saveAsNewLayoutAction({ sourceLayoutId: L.id, name: saveAsNew.name, draft: draftRef.current });
      if (res.ok) {
        setBaseline(draftRef.current); // leaving on purpose: the edits now live in the new layout
        router.push(`/admin/product-layouts/${res.id}?from=${L.id}`);
        return;
      }
      toast.error('New layout not saved');
      if (res.code === 'INVALID' && res.sectionErrors) {
        setSaveAsNew(null);
        showErrors(res);
        return;
      }
      setSaveAsNew({ ...saveAsNew, busy: false, error: res.error });
    } catch {
      setSaveAsNew({ ...saveAsNew, busy: false, error: 'The layout could not be saved. Please try again.' });
      toast.error('New layout not saved');
    }
  };

  const makeCopy = async () => {
    if (dirty && !window.confirm('Your unsaved changes are not copied. Make a copy of the saved layout anyway?')) return;
    setCopying(true);
    const res = await duplicateProductLayoutAction(L.id).catch(actionFailed);
    setCopying(false);
    if (!res.ok) {
      setProblem(res.error);
      toast.error('Layout not copied');
      return;
    }
    setBaseline(draftRef.current);
    router.push(`/admin/product-layouts/${res.id}?copied=${L.id}`);
  };

  const loadVersion = (which: 'previous' | 'original') => {
    const v = which === 'previous' ? server.previous : server.original;
    setReplace(null);
    if (!v) return;
    const loaded = adoptKeys(structuredClone(v), baseline);
    // a copy's original design carries the name of the layout it was copied from: keep this layout's own name then
    const clash = server.layouts.some((l) => l.id !== L.id && layoutNameKey(l.name) === layoutNameKey(loaded.name));
    setDraft(clash ? { ...loaded, name: draftRef.current.name, description: draftRef.current.description } : loaded);
    toast.info(which === 'previous' ? 'Previous version loaded. Save to keep it.' : 'Original design loaded. Save to keep it.');
    setErrors({});
    setOpen(new Set());
  };

  /* -------------------------------------------------------------------------------------------- render */

  const changes = warnOpen ? describeChanges(baseline, draft, usedBy) : [];
  const deleting = deleteKey ? draft.sections.find((s) => s.key === deleteKey) : null;
  const sectionsWithErrors = new Set(Object.keys(errors));
  const has = (kind: SectionKind) => draft.sections.some((s) => s.kind === kind);
  const featuredCount = draft.sections.filter((s) => s.kind === 'featuredCollection').length;
  const usedLink = (
    <Link href={`/admin/products?layout=${encodeURIComponent(L.key)}`} className="font-semibold text-brand-700 hover:underline">
      {usedBy === 0 ? 'Not used by any product' : `Used by ${productsPhrase(usedBy)}`}
      {L.drafts > 0 ? ` (${L.drafts} draft${L.drafts === 1 ? '' : 's'})` : ''}
    </Link>
  );
  const deleteBlocked = L.isProtected
    ? "This is the standard layout used whenever a product has none; it can't be deleted."
    : usedBy > 0
      ? `Used by ${productsPhrase(usedBy)}. Move them to another layout first.`
      : null;

  const actions: SaveBarAction[] = stale
    ? [
        {
          label: 'Reload (your edits will be lost)',
          shortLabel: 'Reload',
          variant: 'secondary',
          type: 'button',
          onClick: () => {
            setBaseline(draftRef.current);
            window.location.reload();
          },
        },
        { label: 'Save as a new layout instead', shortLabel: 'Save as new', type: 'button', onClick: openSaveAsNew },
      ]
    : [
        { label: 'Discard changes', shortLabel: 'Discard', variant: 'secondary', type: 'button', onClick: () => setDiscardOpen(true), disabled: !dirty },
        { label: 'Save layout', shortLabel: 'Save', type: 'button', onClick: save, disabled: !dirty },
      ];

  return (
    <div className="pb-28" data-testid="layout-editor">
      <UnsavedChangesGuard dirty={dirty && !saving} />

      {/* header */}
      <div className="mb-5">
        <Link href="/admin/product-layouts" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand-600 hover:underline">
          ← Product page layouts
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 break-words font-heading text-xl font-bold text-ink-dark">{draft.name || 'Untitled layout'}</h1>
              {!renaming && (
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                >
                  Rename
                </button>
              )}
            </div>
            {!renaming &&
              (draft.description ? (
                <p className="mt-0.5 text-sm text-gray-600">{draft.description}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setRenaming(true)}
                  className="mt-0.5 inline-flex min-h-10 items-center text-left text-sm font-semibold text-brand-700 hover:underline"
                  data-testid="add-description"
                >
                  + Add a short note saying what this layout is for
                </button>
              ))}
            <p className="mt-1 text-sm">{usedLink}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3.5 text-xs font-semibold text-ink-dark hover:border-brand-400 hover:text-brand-600"
            >
              Preview changes
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </button>
            <MenuButton
              label="More actions for this layout"
              title="This layout"
              testId="layout-menu"
              items={[
                { label: copying ? 'Making a copy…' : 'Make a copy', onClick: makeCopy, disabled: copying },
                { label: 'Move products…', onClick: () => setMove({ fromId: L.id, toId: null, title: 'Move this layout’s products' }) },
                {
                  label: server.layout.lastSavedAt ? `Undo last save (${timeLabel(server.layout.lastSavedAt)})` : 'Undo last save',
                  onClick: () => setReplace('previous'),
                  disabled: !server.previous,
                  disabledReason: 'Nothing to undo yet.',
                },
                {
                  label: 'Restore the original design',
                  onClick: () => setReplace('original'),
                  disabled: !server.original,
                  disabledReason: 'This layout was made from scratch.',
                },
                { label: 'Delete layout', onClick: () => setDeleteLayoutOpen(true), tone: 'danger', disabled: !!deleteBlocked, disabledReason: deleteBlocked ?? undefined },
              ]}
            />
          </div>
        </div>

        {renaming && (
          <div className="mt-3 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2" data-testid="rename-fields">
            <div>
              <label htmlFor="layout-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Layout name
              </label>
              <TextInput
                id="layout-name"
                value={draft.name}
                maxLength={MAX_LAYOUT_NAME}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, name: e.target.value }));
                  setNameError(null);
                }}
                className={nameError?.field === 'name' ? 'border-red-400' : ''}
              />
              {nameError?.field === 'name' && <p className="mt-1 text-xs font-medium text-red-600">{nameError.message}</p>}
            </div>
            <div>
              <label htmlFor="layout-description" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                What it’s for (optional)
              </label>
              <TextInput
                id="layout-description"
                value={draft.description}
                maxLength={MAX_DESCRIPTION}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, description: e.target.value }));
                  setNameError(null);
                }}
              />
              <p className="mt-1 text-xs text-gray-400">A short note to help you pick the right layout, e.g. “For office chairs and desks.”</p>
              {nameError?.field === 'description' && <p className="mt-1 text-xs font-medium text-red-600">{nameError.message}</p>}
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Done
              </button>
              <span className="ml-2 text-xs text-gray-500">The new name is kept when you save the layout.</span>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {flash && <Notice tone="success">{flash}</Notice>}
        {serverError === 'in-use' && <Notice tone="error">This layout is used by products, so it was not deleted. Move them to another layout first.</Notice>}
        {serverError === 'protected' && <Notice tone="error">The standard layout can’t be deleted.</Notice>}
        {usedBy >= 2 && (
          <Notice
            tone="warning"
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={makeCopy} disabled={copying} className="inline-flex min-h-10 items-center rounded-lg bg-amber-500 px-3 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">
                  Make a copy
                </button>
                <button
                  type="button"
                  onClick={openSaveAsNew}
                  className="inline-flex min-h-10 items-center rounded-lg border border-amber-400 bg-white px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                >
                  Save my changes as a new layout
                </button>
              </div>
            }
          >
            Changes here affect {usedBy} products. To change only some of them, make a copy first.
          </Notice>
        )}
        {usedBy === 0 && (
          <Notice
            tone="info"
            action={
              otherLayouts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMove({ fromId: moveFromId ?? copiedFromId, toId: L.id, title: 'Bring products here' })}
                  className="inline-flex min-h-10 items-center rounded-lg bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  Bring products here…
                </button>
              )
            }
          >
            This layout isn’t used by any product yet.
          </Notice>
        )}

        <fieldset disabled={saving} aria-busy={saving} className="min-w-0">
          <legend className="sr-only">Sections</legend>
          <div className="mb-2 flex items-end justify-between gap-2">
            <div>
              <h2 className="font-heading text-base font-bold text-ink-dark">Sections</h2>
              <p className="text-sm text-gray-500">Shown in this order under the product description. Drag or use the arrows to move them.</p>
            </div>
          </div>

          <div aria-hidden className="mb-2 flex min-h-12 items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 text-sm text-gray-500">
            Product photos, price and description
          </div>

          {draft.sections.length === 0 && (
            <p className="mb-2 rounded-xl border border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">No sections. The product page ends after the description.</p>
          )}

          <SortableList
            items={draft.sections}
            getKey={(s) => s.key}
            onReorder={(sections) => setDraft((d) => ({ ...d, sections }))}
            onDragStateChange={setDragging}
            ariaLabel="Sections"
            renderItem={(s, ctl) => {
              const isOpen = open.has(s.key) && !dragging;
              const label = labels.get(s.key) ?? SECTION_KIND_COPY[s.kind].name;
              const warn = sectionWarnings(s.kind, s.values);
              const thumb = sectionThumb(s.kind, s.values);
              const err = errors[s.key];
              const singleton = SINGLETON_KINDS.includes(s.kind);
              const copyBlocked = singleton
                ? 'There can be only one of these.'
                : draft.sections.length >= MAX_SECTIONS
                  ? `A layout can have up to ${MAX_SECTIONS} sections.`
                  : s.kind === 'featuredCollection' && featuredCount >= MAX_FEATURED_PER_LAYOUT
                    ? `A layout can have up to ${MAX_FEATURED_PER_LAYOUT} of these.`
                    : null;
              return (
                <div
                  data-section-key={s.key}
                  data-testid="layout-section"
                  data-kind={s.kind}
                  className={`scroll-mt-20 rounded-xl border bg-white shadow-sm ${err ? 'border-red-400 ring-1 ring-red-300' : 'border-gray-200'} ${s.hidden ? 'bg-gray-50' : ''}`}
                >
                  <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {ctl.handle}
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-gray-200 object-cover" />
                      ) : (
                        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                          <KindDiagram kind={s.kind} className="h-7 w-10" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${s.hidden ? 'text-gray-500' : 'text-ink-dark'}`}>{label}</p>
                        <p className="truncate text-xs text-gray-500" data-testid="section-summary">
                          {sectionSummaryText(s.kind, s.values, s.kind === 'overlay' || s.kind === 'imageText' ? plainText(s.bodyHtml) : '')}
                        </p>
                        {(s.hidden || warn.deadButton || warn.deletedCollection || err) && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {s.hidden && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">Hidden</span>}
                            {warn.deadButton && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">⚠ Button goes nowhere</span>}
                            {warn.deletedCollection && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">⚠ Collection was deleted</span>}
                            {err && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">⚠ Fix this</span>}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-0.5 gap-y-1 sm:justify-start sm:gap-1">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => toggleOpen(s.key)}
                        className={`inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold ${isOpen ? 'bg-brand-50 text-brand-700' : 'text-brand-700 hover:bg-brand-50'}`}
                      >
                        {isOpen ? 'Close' : 'Edit'}
                        <span className="sr-only"> {label}</span>
                      </button>
                      <span className="inline-flex items-center px-1" title="Show on the store">
                        <ToggleSwitch label="Show on the store" checked={!s.hidden} onChange={(on) => patchSection(s.key, { hidden: !on })} />
                      </span>
                      <MenuButton
                        label={`More actions for ${label}`}
                        title={label}
                        items={[
                          { label: 'Copy this section', onClick: () => copySection(s.key), disabled: !!copyBlocked, disabledReason: copyBlocked ?? undefined },
                          { label: 'Delete section', onClick: () => setDeleteKey(s.key), tone: 'danger' },
                        ]}
                      />
                      {ctl.arrows}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="border-t border-gray-100" data-testid="section-editor">
                      <div className="sticky top-16 z-10 flex min-h-11 items-center gap-2 border-b border-gray-100 bg-white/95 px-3 backdrop-blur lg:top-0">
                        <button
                          type="button"
                          onClick={() => {
                            toggleOpen(s.key, false);
                            scrollTo(s.key);
                          }}
                          className="inline-flex min-h-10 shrink-0 whitespace-nowrap items-center rounded-lg px-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                        >
                          ← Back to all sections
                        </button>
                        <span className="min-w-0 truncate text-sm font-semibold text-gray-600">{label}</span>
                      </div>
                      <div className="p-4">
                        {err && (
                          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                            <p className="font-semibold">Fix this:</p>
                            <ul className="mt-1 list-disc pl-5">
                              {[...new Set(Object.values(err))].map((m) => (
                                <li key={m}>{m}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <SectionBody
                          section={s}
                          setValues={(next: DraftValues | ((cur: DraftValues) => DraftValues)) =>
                            setDraft((d) => ({
                              ...d,
                              sections: d.sections.map((x) => (x.key === s.key ? ({ ...x, values: typeof next === 'function' ? next(x.values) : next } as DraftSection) : x)),
                            }))
                          }
                          setBody={(bodyHtml: string) => patchSection(s.key, { bodyHtml })}
                          errors={err ?? {}}
                          imageMeta={imageMeta}
                          addImageMeta={addImageMeta}
                          collections={collections}
                          addCollection={addCollection}
                          linkTargets={server.linkTargets}
                          brokenLinks={server.brokenLinks[s.key] ?? []}
                          readOnly={saving}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          />

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              disabled={draft.sections.length >= MAX_SECTIONS}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white px-4 text-sm font-semibold text-brand-700 hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusIcon className="h-4 w-4" />
              Add section
            </button>
            {draft.sections.length >= MAX_SECTIONS && <p className="mt-1 text-xs text-gray-500">A layout can have up to {MAX_SECTIONS} sections.</p>}
          </div>
        </fieldset>
      </div>

      <StickySaveBar dirty={dirty} saving={saving} status={usedBy ? `Used by ${productsPhrase(usedBy)}` : 'Not used by any product yet'} error={problem} actions={actions} />
      <MoveToast done={moveDone} onClose={() => setMoveDone(null)} />

      {/* add section */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add a section" width="max-w-lg" testId="add-section-dialog">
        <ul className="grid gap-2">
          {ADDABLE_KINDS.map((kind) => {
            const reason =
              draft.sections.length >= MAX_SECTIONS
                ? `A layout can have up to ${MAX_SECTIONS} sections.`
                : SINGLETON_KINDS.includes(kind) && has(kind)
                  ? 'Already in this layout'
                  : kind === 'featuredCollection' && featuredCount >= MAX_FEATURED_PER_LAYOUT
                    ? `Up to ${MAX_FEATURED_PER_LAYOUT} per layout`
                    : null;
            return (
              <li key={kind}>
                <button
                  type="button"
                  onClick={() => addSection(kind)}
                  disabled={!!reason}
                  data-kind={kind}
                  className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2 text-left hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-gray-200 disabled:hover:bg-transparent"
                >
                  <KindDiagram kind={kind} className="h-8 w-12 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink-dark">{SECTION_KIND_COPY[kind].name}</span>
                    <span className="block text-xs text-gray-500">{reason ?? SECTION_KIND_COPY[kind].description}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>

      {/* delete section */}
      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `Delete “${labels.get(deleting.key)}”?` : ''}
        consequences={
          deleting
            ? deleting.kind === 'reviews'
              ? [`Customers can't see or write reviews on ${productsPhrase(usedBy, 'these')}`, 'Tip: Hide keeps it for later.']
              : deleting.kind === 'recommendations'
                ? ['The “You may also like” products on these pages', 'Tip: Hide keeps it for later.']
                : [`The ${deleting.kind === 'imageText' ? 'photo and text' : deleting.kind === 'icons' ? 'icons' : deleting.kind === 'testimonials' ? 'quotes' : deleting.kind === 'slideshow' ? 'photos' : deleting.kind === 'overlay' ? 'photo and text' : 'product row'} in this section`]
            : []
        }
        confirmLabel="Delete section"
        tone="danger"
        note="Removed when you save."
        onConfirm={() => {
          if (deleteKey) removeSection(deleteKey);
          setDeleteKey(null);
        }}
        onCancel={() => setDeleteKey(null)}
      />

      {/* discard */}
      <ConfirmDialog
        open={discardOpen}
        title="Discard your changes?"
        consequences={['Everything you changed since the last save']}
        confirmLabel="Discard changes"
        tone="danger"
        onConfirm={() => {
          setDraft(baseline);
          setErrors({});
          setProblem(null);
          setNameError(null);
          setDiscardOpen(false);
          toast.info('Changes discarded');
        }}
        onCancel={() => setDiscardOpen(false)}
      />

      {/* undo / restore */}
      <ConfirmDialog
        open={replace != null}
        title={replace === 'previous' ? 'Replace what’s in the editor with the version from before your last save?' : 'Replace what’s in the editor with the original design?'}
        consequences={[]}
        note="Nothing changes on the store until you save. You can preview it first."
        confirmLabel={replace === 'previous' ? 'Load the earlier version' : 'Load the original design'}
        onConfirm={() => replace && loadVersion(replace)}
        onCancel={() => setReplace(null)}
      />

      {/* shared-change warning */}
      <Dialog
        open={warnOpen}
        onClose={() => setWarnOpen(false)}
        title={`Change all ${usedBy} products?`}
        testId="save-warning"
        footer={
          <>
            <button type="button" onClick={() => setWarnOpen(false)} className={dialogButton.secondary}>
              Keep editing
            </button>
            <button type="button" onClick={openSaveAsNew} className={dialogButton.secondary}>
              Save as a new layout instead
            </button>
            <button type="button" onClick={doSave} className={dialogButton.primary}>
              Save for all {usedBy} products
            </button>
          </>
        }
      >
        <p className="text-sm font-semibold text-ink-dark">What changed</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700" data-testid="change-list">
          {(changes.length ? changes : ['Small changes']).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-gray-600">
          Every product using “{draft.name || L.name}” will show these changes straight away. You can undo the last save from the ⋯ menu.
        </p>
      </Dialog>

      {/* save as a new layout */}
      <Dialog
        open={!!saveAsNew}
        onClose={() => setSaveAsNew(null)}
        title="Save as a new layout"
        testId="save-as-new"
        footer={
          <>
            <button type="button" onClick={() => setSaveAsNew(null)} className={dialogButton.secondary}>
              Cancel
            </button>
            <button type="button" onClick={doSaveAsNew} disabled={saveAsNew?.busy} className={dialogButton.primary}>
              {saveAsNew?.busy ? 'Saving…' : 'Save as a new layout'}
            </button>
          </>
        }
      >
        <p className="mb-3 text-sm text-gray-600">
          Your changes go into a new layout that no product uses yet. “{L.name}” stays as it is. Next you can choose which products move to it.
        </p>
        <label htmlFor="save-as-new-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Name of the new layout
        </label>
        <TextInput
          id="save-as-new-name"
          value={saveAsNew?.name ?? ''}
          maxLength={MAX_LAYOUT_NAME}
          onChange={(e) => saveAsNew && setSaveAsNew({ ...saveAsNew, name: e.target.value, error: null })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void doSaveAsNew();
            }
          }}
        />
        {saveAsNew?.error && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">
            {saveAsNew.error}
          </p>
        )}
      </Dialog>

      {/* delete layout */}
      <ConfirmDialog
        open={deleteLayoutOpen}
        title={`Delete “${L.name}”?`}
        consequences={[`The layout “${L.name}” and its ${draft.sections.length} section${draft.sections.length === 1 ? '' : 's'}`, 'Photos uploaded only for this layout', 'Its undo history']}
        confirmLabel="Delete permanently"
        tone="danger"
        note="This can't be undone."
        onConfirm={() => undefined}
        onCancel={() => setDeleteLayoutOpen(false)}
        renderConfirm={(className) => (
          <form
            action={async (fd) => {
              setBaseline(draftRef.current);
              await deleteProductLayoutAction(fd);
            }}
            className="contents"
          >
            <input type="hidden" name="id" value={L.id} />
            <SubmitDeleteButton className={className} />
          </form>
        )}
      />

      <MoveProductsDialog
        open={!!move}
        onClose={() => setMove(null)}
        layouts={server.layouts}
        fromId={move?.fromId ?? null}
        toId={move?.toId ?? null}
        title={move?.title ?? ''}
        onMoved={(r) => {
          setMove(null);
          setMoveDone(r);
          router.refresh();
        }}
      />

      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} data={server} draft={draft} onErrors={showErrors} />
    </div>
  );
}

/** The per-kind editor for one section. */
function SectionBody(p: SectionEditorProps<SectionKind>) {
  switch (p.section.kind) {
    case 'overlay':
      return <OverlayEditor {...(p as SectionEditorProps<'overlay'>)} />;
    case 'imageText':
      return <ImageTextEditor {...(p as SectionEditorProps<'imageText'>)} />;
    case 'icons':
      return <IconsEditor {...(p as SectionEditorProps<'icons'>)} />;
    case 'testimonials':
      return <TestimonialsEditor {...(p as SectionEditorProps<'testimonials'>)} />;
    case 'slideshow':
      return <SlideshowEditor {...(p as SectionEditorProps<'slideshow'>)} />;
    case 'featuredCollection':
      return <FeaturedEditor {...(p as SectionEditorProps<'featuredCollection'>)} />;
    default:
      return <AutomaticEditor kind={p.section.kind} />;
  }
}

/** "Preview changes": pick a product, then open it in a new tab with the editor's current (unsaved) sections. */
function PreviewDialog({
  open,
  onClose,
  data,
  draft,
  onErrors,
}: {
  open: boolean;
  onClose: () => void;
  data: LayoutEditorData;
  draft: LayoutDraft;
  onErrors: (r: { error: string; sectionErrors?: SectionErrors; field?: 'name' | 'description' }) => void;
}) {
  const L = data.layout;
  const [q, setQ] = useState('');
  const [items, setItems] = useState<MoveCandidate[] | null>(null);
  const [picked, setPicked] = useState<{ id: number; title: string } | null>(data.previewProduct);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const anyProduct = L.usedBy === 0;

  useEffect(() => {
    if (!open) return;
    setError(null);
    const t = window.setTimeout(() => {
      searchProductsForMoveAction({ q, layoutId: anyProduct ? null : L.id, take: 8 })
        .then((r) => setItems(r.items))
        .catch(() => setItems([]));
    }, 200);
    return () => window.clearTimeout(t);
  }, [open, q, anyProduct, L.id]);

  const go = async () => {
    if (!picked) {
      setError('Pick a product to preview on.');
      toast.error('Preview not opened');
      return;
    }
    if (pendingUploadCount() > 0) {
      setError(WAITING_FOR_UPLOAD);
      toast.info('The preview waits until the upload finishes');
      return;
    }
    // opened now (inside the click) so the browser doesn't block it; filled in when the preview is ready
    const win = window.open('about:blank', '_blank');
    setBusy(true);
    setError(null);
    try {
      const res = await createLayoutPreviewAction({ layoutId: L.id, draft, productId: picked.id });
      if (res.ok) {
        if (win) {
          win.location.href = res.url;
          toast.info('Preview opened in a new tab');
        } else window.location.assign(res.url);
        onClose();
      } else {
        win?.close();
        toast.error('Preview not opened');
        if (res.code === 'INVALID' && (res.sectionErrors || res.field)) {
          onClose();
          onErrors(res);
        } else setError(res.error);
      }
    } catch {
      win?.close();
      setError('The preview could not be made. Please try again.');
      toast.error('Preview not opened');
    } finally {
      setBusy(false);
    }
  };

  const list = items ?? [];
  const shown = picked && !list.some((i) => i.id === picked.id) ? [{ id: picked.id, title: picked.title, image: null, status: '', layoutName: '' }, ...list] : list;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Preview on"
      testId="preview-dialog"
      footer={
        <>
          <button type="button" onClick={onClose} className={dialogButton.secondary}>
            Cancel
          </button>
          <button type="button" onClick={go} disabled={busy || !picked} className={dialogButton.primary}>
            {busy ? 'Opening…' : 'Open the preview'}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-gray-600">
        Shows your changes on a real product page. Only you can see it.
        {anyProduct && ' Not used yet, so pick any product to preview on.'}
      </p>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products…"
        aria-label="Search products"
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
        {items == null ? (
          <li className="px-3 py-3 text-sm text-gray-500">Loading…</li>
        ) : shown.length === 0 ? (
          <li className="px-3 py-3 text-sm text-gray-500">No products found.</li>
        ) : (
          shown.map((p) => (
            <li key={p.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-gray-50">
                <input type="radio" name="preview-product" checked={picked?.id === p.id} onChange={() => setPicked({ id: p.id, title: p.title })} className="h-5 w-5" />
                <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                {p.status === 'DRAFT' && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">Draft</span>}
              </label>
            </li>
          ))
        )}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </Dialog>
  );
}
