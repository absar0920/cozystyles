'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { LayoutSummary } from '@/components/admin/LayoutSummary';
import { MenuButton } from '@/components/admin/MenuButton';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { Dialog, dialogButton } from '@/components/admin/Dialog';
import { Select, TextInput } from '@/components/admin/ui';
import { CopyIcon, PlusIcon } from '@/components/admin/icons';
import { PROTECTED_LAYOUT_KEYS, MAX_LAYOUT_NAME } from '@/lib/product-layouts';
import { productsPhrase } from '@/lib/product-layout-draft';
import { createProductLayoutAction, deleteProductLayoutAction, duplicateProductLayoutAction } from '@/app/admin/actions/product-layouts';
import type { LayoutChoice } from '../_lib/load';
import { MoveProductsDialog, MoveToast, type MoveDone } from './MoveProducts';

function SubmitDelete({ className }: { className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? 'Deleting…' : 'Delete permanently'}
    </button>
  );
}

/** The cards of the list page (SPEC product-layouts §9.2): contents, used-by counts and actions. */
export function LayoutList({ layouts }: { layouts: LayoutChoice[] }) {
  const router = useRouter();
  const [move, setMove] = useState<LayoutChoice | null>(null);
  const [moveDone, setMoveDone] = useState<MoveDone | null>(null);
  const [del, setDel] = useState<LayoutChoice | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = async (l: LayoutChoice) => {
    setBusy(l.id);
    setError(null);
    const res = await duplicateProductLayoutAction(l.id);
    if (!res.ok) {
      setBusy(null);
      setError(res.error);
      return;
    }
    router.push(`/admin/product-layouts/${res.id}?copied=${l.id}`);
  };

  return (
    <>
      {error && (
        <p role="alert" className="mb-3 text-sm font-medium text-red-600">
          {error}
        </p>
      )}
      <ul className="grid gap-3 lg:grid-cols-2" data-testid="layout-list">
        {layouts.map((l) => {
          const protectedKey = PROTECTED_LAYOUT_KEYS.includes(l.key);
          const blocked = protectedKey
            ? "This is the standard layout used whenever a product has none; it can't be deleted."
            : l.usedBy > 0
              ? `Used by ${productsPhrase(l.usedBy)}. Move them to another layout first.`
              : null;
          return (
            <li key={l.id} data-testid="layout-card" className="flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/product-layouts/${l.id}`} className="break-words font-heading text-base font-bold text-ink-dark hover:text-brand">
                  {l.name}
                </Link>
                {l.description && <p className="mt-0.5 text-sm text-gray-600">{l.description}</p>}
                <div className="mt-2">
                  <LayoutSummary summary={l.summary} />
                </div>
                <p className="mt-2 text-sm">
                  <Link href={`/admin/products?layout=${encodeURIComponent(l.key)}`} className="font-semibold text-brand-700 hover:underline" data-testid="used-by">
                    {l.usedBy === 0 ? 'Not used by any product' : `Used by ${productsPhrase(l.usedBy)}`}
                    {l.drafts > 0 ? ` (${l.drafts} draft${l.drafts === 1 ? '' : 's'})` : ''}
                  </Link>
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                <Link
                  href={`/admin/product-layouts/${l.id}`}
                  className="inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => copy(l)}
                  disabled={busy != null}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <CopyIcon className="h-4 w-4" />
                  {busy === l.id ? 'Copying…' : 'Make a copy'}
                </button>
                <MenuButton
                  label={`More actions for ${l.name}`}
                  title={l.name}
                  items={[
                    { label: 'Rename', onClick: () => router.push(`/admin/product-layouts/${l.id}?rename=1`) },
                    { label: 'Move products…', onClick: () => setMove(l), disabled: l.usedBy === 0, disabledReason: 'No product uses this layout.' },
                    { label: 'Delete', onClick: () => setDel(l), tone: 'danger', disabled: !!blocked, disabledReason: blocked ?? undefined },
                  ]}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <MoveProductsDialog
        open={!!move}
        onClose={() => setMove(null)}
        layouts={layouts}
        fromId={move?.id ?? null}
        toId={null}
        title="Move this layout’s products"
        onMoved={(r) => {
          setMove(null);
          setMoveDone(r);
          router.refresh();
        }}
      />
      <MoveToast done={moveDone} onClose={() => setMoveDone(null)} />

      <ConfirmDialog
        open={!!del}
        title={del ? `Delete “${del.name}”?` : ''}
        consequences={
          del
            ? [
                `The layout “${del.name}” and its ${del.summary.chips.reduce((n, c) => n + c.count, 0)} sections`,
                'Photos uploaded only for this layout',
                'Its undo history',
              ]
            : []
        }
        confirmLabel="Delete permanently"
        tone="danger"
        note="This can't be undone."
        onConfirm={() => undefined}
        onCancel={() => setDel(null)}
        renderConfirm={(className) => (
          <form action={deleteProductLayoutAction} className="contents">
            <input type="hidden" name="id" value={del?.id ?? ''} />
            <SubmitDelete className={className} />
          </form>
        )}
      />
    </>
  );
}

/** "+ New layout": start from an existing layout or from an empty one. */
export function NewLayoutButton({ layouts }: { layouts: LayoutChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<string>('empty');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fromLayout = layouts.find((l) => String(l.id) === from);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await createProductLayoutAction({ name, fromLayoutId: fromLayout?.id ?? null });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      router.push(`/admin/product-layouts/${res.id}?created=1`);
    } catch {
      setError('The layout could not be created. Please try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
          setBusy(false);
        }}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition hover:bg-brand-600"
      >
        <PlusIcon className="h-4 w-4" />
        New layout
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New layout"
        testId="new-layout-dialog"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={dialogButton.secondary}>
              Cancel
            </button>
            <button type="button" onClick={create} disabled={busy} className={dialogButton.primary}>
              {busy ? 'Creating…' : 'Create layout'}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <div>
            <label htmlFor="new-layout-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Name
            </label>
            <TextInput
              id="new-layout-name"
              value={name}
              maxLength={MAX_LAYOUT_NAME}
              placeholder="e.g. Outdoor furniture"
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void create();
                }
              }}
            />
          </div>
          <div>
            <label htmlFor="new-layout-from" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Start from
            </label>
            <Select id="new-layout-from" value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="empty">Empty (only “You may also like”)</option>
              {layouts.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {fromLayout && (
              <div className="mt-1.5">
                <LayoutSummary summary={fromLayout.summary} compact />
              </div>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
