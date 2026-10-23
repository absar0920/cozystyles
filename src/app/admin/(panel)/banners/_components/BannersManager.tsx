'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { deleteBannerAction, reorderBannersAction, toggleBannerAction } from '@/app/admin/actions/banners';
import type { LinkTarget } from '@/lib/links';
import { Notice, ToggleSwitch } from '@/components/admin/ui';
import { SortableList } from '@/components/admin/SortableList';
import { StickySaveBar } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { linkTargetText } from '@/components/admin/LinkPicker';
import { ImageIcon } from '@/components/admin/icons';
import { BannerForm } from './BannerForm';

export type BannerRow = { id: number; title: string; href: string; image: string; mobileImage: string | null; active: boolean };

const ORDER_HINT = 'Save or undo the new order first.';
const FORM_HINT = "Save or cancel the banner you're editing first.";

const btn =
  'inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50';

function Thumb({ src, aspect, label }: { src: string | null; aspect: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50" style={{ aspectRatio: aspect }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-1 text-center text-[10px] leading-tight text-gray-400">
            <ImageIcon className="h-4 w-4" />
          </div>
        )}
      </div>
      <span className="text-[11px] text-gray-400">{label}</span>
    </div>
  );
}

/**
 * The banners list: drag/arrow ordering with its own "Save order" bar, On/Off switches, Edit (inline form) and
 * Delete. Only one thing at a time: the order and an open form never have unsaved changes together.
 */
export function BannersManager({ banners, targets }: { banners: BannerRow[]; targets: Record<string, LinkTarget> }) {
  const propIds = useMemo(() => banners.map((b) => b.id), [banners]);
  const byId = useMemo(() => new Map(banners.map((b) => [b.id, b])), [banners]);
  const [order, setOrder] = useState<number[]>(propIds);
  const [baseline, setBaseline] = useState<number[]>(propIds);
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const orderDirty = order.join(',') !== baseline.join(',');

  // Fresh server data (after a save, toggle or delete): keep an unsaved order, drop deleted rows, append new ones.
  const propKey = propIds.join(',');
  useEffect(() => {
    setOrder((current) => {
      const dirty = current.join(',') !== baseline.join(',');
      if (!dirty) return propIds;
      const known = new Set(propIds);
      const kept = current.filter((id) => known.has(id));
      return [...kept, ...propIds.filter((id) => !kept.includes(id))];
    });
    setBaseline(propIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propKey]);

  // a deleted banner closes its form
  useEffect(() => {
    if (typeof editing === 'number' && !byId.has(editing)) setEditing(null);
  }, [byId, editing]);

  const rows = order.map((id) => byId.get(id)).filter((b): b is BannerRow => !!b);

  const saveOrder = () => {
    setOrderError(null);
    startSaving(async () => {
      const res = await reorderBannersAction(order);
      if (res.ok) {
        setBaseline(order);
        setFlash('Order saved. The home page is updated.');
      } else setOrderError(res.error ?? 'The order could not be saved.');
    });
  };

  // a scroll to the saved banner still waiting for the history step below (cancelled on unmount)
  const pendingReveal = useRef<(() => void) | null>(null);
  useEffect(() => () => pendingReveal.current?.(), []);

  const onSaved = useCallback((id: number, guarded: boolean) => {
    setEditing(null);
    setFlash('Saved. The home page is updated.');
    pendingReveal.current?.();
    const reveal = () => document.getElementById(`banner-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (!guarded) {
      const t = window.setTimeout(reveal, 150);
      pendingReveal.current = () => window.clearTimeout(t);
      return;
    }
    // A form with unsaved changes had its UnsavedChangesGuard add a Back-button entry; once the save has settled
    // the guard removes it with history.back(), and the browser then scrolls back to where the page was when the
    // form was first changed. Scrolling to the banner before that step made the page slide down and straight
    // back up, so wait for it (or give up waiting after 3 s) and scroll once the browser's own scroll has begun.
    const done = () => {
      window.removeEventListener('popstate', done);
      window.clearTimeout(fallback);
      const t = window.setTimeout(reveal, 0);
      pendingReveal.current = () => window.clearTimeout(t);
    };
    const fallback = window.setTimeout(done, 3000);
    window.addEventListener('popstate', done);
    pendingReveal.current = () => {
      window.removeEventListener('popstate', done);
      window.clearTimeout(fallback);
    };
  }, []);
  const onCancel = useCallback(() => setEditing(null), []);

  const open = (what: number | 'new') => {
    setFlash(null);
    setEditing(what);
  };

  return (
    <div className="space-y-4">
      <Notice tone="info">
        Put your text inside the image — the slider shows only the picture. Recommended size: 1200 × 462 for computers,
        450 × 700 for phones.
      </Notice>
      {flash && <Notice tone="success">{flash}</Notice>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => open('new')}
          disabled={orderDirty || editing !== null}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add banner
        </button>
        {orderDirty && <span className="text-xs text-gray-500">{ORDER_HINT}</span>}
        <span className="text-xs text-gray-500">
          {rows.length} banner{rows.length === 1 ? '' : 's'} · {rows.filter((b) => b.active).length} shown on the store
        </span>
      </div>

      {editing === 'new' && <BannerForm banner={null} onSaved={onSaved} onCancel={onCancel} />}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
          No banners yet. Add one to show a slide at the top of the home page.
        </div>
      ) : (
        <SortableList
          items={rows}
          getKey={(b) => String(b.id)}
          onReorder={(items) => {
            setFlash(null);
            setOrder(items.map((b) => b.id));
          }}
          ariaLabel="Home banners"
          disabled={editing !== null}
          disabledReason={FORM_HINT}
          renderItem={(b, ctl) => {
            const isEditing = editing === b.id;
            return (
              <section
                id={`banner-${b.id}`}
                data-testid="banner-card"
                data-banner-id={b.id}
                className={`scroll-mt-24 rounded-xl border bg-white shadow-sm ${isEditing ? 'border-brand-300' : 'border-gray-200'}`}
              >
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:p-4">
                  <div className="flex items-center gap-1 sm:flex-col">
                    {ctl.handle}
                    <span className="sm:hidden">{ctl.arrows}</span>
                    <span className="ml-auto text-xs font-semibold text-gray-400 sm:ml-0">#{ctl.index + 1}</span>
                  </div>
                  <div className="grid min-w-0 grid-cols-[1fr_64px] gap-3 sm:w-[340px] sm:shrink-0">
                    <Thumb src={b.image} aspect="1200 / 462" label="Computer" />
                    <Thumb src={b.mobileImage} aspect="450 / 700" label={b.mobileImage ? 'Phone' : 'Phone: same'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink-dark" title={b.title}>
                      {b.title || 'Untitled banner'}
                    </p>
                    <p className={`mt-0.5 truncate text-sm ${targets[b.href]?.missing ? 'font-medium text-red-600' : 'text-gray-500'}`}>
                      {targets[b.href]?.missing && '⚠ '}
                      Link: {linkTargetText(targets[b.href], b.href)}
                    </p>
                    <p className={`mt-0.5 text-xs font-semibold ${b.active ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {b.active ? 'Shown on the store' : 'Hidden'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="hidden sm:inline-flex">{ctl.arrows}</span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                      <ToggleSwitch
                        label={b.active ? `Hide “${b.title}” on the store` : `Show “${b.title}” on the store`}
                        checked={b.active}
                        formAction={toggleBannerAction}
                        fields={{ id: String(b.id) }}
                      />
                      {b.active ? 'On' : 'Off'}
                    </span>
                    <button
                      type="button"
                      className={btn}
                      onClick={() => open(b.id)}
                      disabled={orderDirty || editing !== null}
                      title={orderDirty ? ORDER_HINT : editing !== null ? FORM_HINT : undefined}
                    >
                      Edit
                    </button>
                    <ConfirmDelete
                      action={deleteBannerAction}
                      fields={{ id: String(b.id) }}
                      title={`Delete “${b.title || 'this banner'}”?`}
                      consequences={['The slide is removed from the home page', 'Its uploaded photos are deleted if not used elsewhere']}
                      trigger="icon"
                      triggerLabel={`Delete “${b.title}”`}
                      disabled={editing !== null || orderDirty}
                    />
                  </div>
                </div>
                {isEditing && (
                  <div className="border-t border-gray-100 p-3 sm:p-4">
                    <BannerForm banner={b} target={targets[b.href]} onSaved={onSaved} onCancel={onCancel} />
                  </div>
                )}
              </section>
            );
          }}
        />
      )}

      {editing === null && orderDirty && (
        <>
          <UnsavedChangesGuard dirty={!saving} />
          <StickySaveBar
            dirty
            saving={saving}
            error={orderError}
            actions={[
              { label: 'Undo', variant: 'secondary', type: 'button', onClick: () => setOrder(baseline) },
              { label: 'Save order', type: 'button', onClick: saveOrder },
            ]}
          />
        </>
      )}
    </div>
  );
}
