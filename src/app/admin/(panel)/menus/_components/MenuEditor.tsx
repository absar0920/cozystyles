'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { saveMenuAction } from '@/app/admin/actions/menus';
import { resolveLinkTargetsAction } from '@/app/admin/actions/links';
import type { LinkTarget } from '@/lib/links';
import type { MenuNodeInput } from '../_lib/tree';
import { CheckboxField, Notice, ToggleSwitch } from '@/components/admin/ui';
import { SortableList } from '@/components/admin/SortableList';
import { toast } from '@/components/toast/toast';
import { SAVE_ERROR_TOAST, StickySaveBar } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { LinkPicker, linkTargetText } from '@/components/admin/LinkPicker';
import { TrashIcon } from '@/components/admin/icons';

type Node = Omit<MenuNodeInput, 'children'> & { key: string; children: Node[] };

let keySeq = 0;
const newKey = () => `new-${++keySeq}`;

function fromInput(nodes: MenuNodeInput[]): Node[] {
  return nodes.map((n) => ({ ...n, key: n.id != null ? `m${n.id}` : newKey(), children: fromInput(n.children) }));
}

function toInput(nodes: Node[]): MenuNodeInput[] {
  return nodes.map(({ key: _key, children, ...rest }) => ({ ...rest, children: toInput(children) }));
}

const snapshot = (nodes: Node[]) => JSON.stringify(toInput(nodes));

/* ------------------------------------------------------------------ immutable tree helpers */

function mapNodes(nodes: Node[], fn: (n: Node) => Node): Node[] {
  return nodes.map((n) => fn({ ...n, children: mapNodes(n.children, fn) }));
}

function updateNode(nodes: Node[], key: string, patch: Partial<Node>): Node[] {
  return mapNodes(nodes, (n) => (n.key === key ? { ...n, ...patch } : n));
}

function setChildren(nodes: Node[], parentKey: string | null, children: Node[]): Node[] {
  if (parentKey == null) return children;
  return mapNodes(nodes, (n) => (n.key === parentKey ? { ...n, children } : n));
}

function removeNode(nodes: Node[], key: string): Node[] {
  return nodes.filter((n) => n.key !== key).map((n) => ({ ...n, children: removeNode(n.children, key) }));
}

function findNode(nodes: Node[], key: string): Node | null {
  for (const n of nodes) {
    if (n.key === key) return n;
    const hit = findNode(n.children, key);
    if (hit) return hit;
  }
  return null;
}

/** keys of the ancestors of `key`, top first */
function pathTo(nodes: Node[], key: string, trail: string[] = []): string[] | null {
  for (const n of nodes) {
    if (n.key === key) return trail;
    const hit = pathTo(n.children, key, [...trail, n.key]);
    if (hit) return hit;
  }
  return null;
}

function countDescendants(n: Node): number {
  return n.children.reduce((sum, c) => sum + 1 + countDescendants(c), 0);
}

/** every node at `depth`, with a readable path ("Home › Bedroom") */
function nodesAtDepth(nodes: Node[], depth: number, prefix = ''): { key: string; path: string }[] {
  return nodes.flatMap((n) => {
    if (n.spacer) return [];
    const path = prefix ? `${prefix} › ${n.label || 'Untitled'}` : n.label || 'Untitled';
    return depth === 0 ? [{ key: n.key, path }] : nodesAtDepth(n.children, depth - 1, path);
  });
}

function firstMissingLabel(nodes: Node[]): Node | null {
  for (const n of nodes) {
    if (!n.spacer && !n.label.trim()) return n;
    const hit = firstMissingLabel(n.children);
    if (hit) return hit;
  }
  return null;
}

function collectHrefs(nodes: Node[], out: Set<string> = new Set()): Set<string> {
  for (const n of nodes) {
    if (n.href) out.add(n.href);
    collectHrefs(n.children, out);
  }
  return out;
}

/* ------------------------------------------------------------------ editor */

type Ctx = {
  location: string;
  maxDepth: number;
  tree: Node[];
  targets: Record<string, LinkTarget>;
  expanded: Set<string>;
  toggleExpanded: (key: string) => void;
  update: (key: string, patch: Partial<Node>) => void;
  reorder: (parentKey: string | null, children: Node[]) => void;
  addChild: (parentKey: string | null, spacer?: boolean) => void;
  move: (key: string, toParentKey: string) => void;
  askRemove: (node: Node) => void;
  /** a save was tried with an item missing its label: show the "label is required" errors from now on */
  showMissing: boolean;
};

/** The label a new item gets from the link picked for it (pages, collections, products, posts, shortcuts). */
function autoLabel(t: LinkTarget): string {
  if (t.missing || t.kind === 'external' || t.kind === 'email' || t.kind === 'phone' || t.kind === 'none') return '';
  return t.label.slice(0, 80);
}

function levelName(location: string, depth: number): string {
  if (location === 'MAIN') return depth === 0 ? 'Top menu item' : depth === 1 ? 'Dropdown heading or link' : 'Link';
  if (location === 'FOOTER_SEO') return depth === 0 ? 'Group title' : 'Link';
  return 'Link';
}

export function MenuEditor({
  location,
  maxDepth,
  initialTree,
  initialTargets,
}: {
  location: string;
  maxDepth: number;
  initialTree: MenuNodeInput[];
  initialTargets: Record<string, LinkTarget>;
}) {
  const [tree, setTree] = useState<Node[]>(() => fromInput(initialTree));
  const [baseline, setBaseline] = useState(() => snapshot(fromInput(initialTree)));
  const [targets, setTargets] = useState(initialTargets);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<Node | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const [saving, startSaving] = useTransition();
  const focusKey = useRef<string | null>(null);

  const dirty = useMemo(() => snapshot(tree) !== baseline, [tree, baseline]);

  // readable names for links picked since the page loaded
  const hrefKey = [...collectHrefs(tree)].sort().join('\n');
  useEffect(() => {
    const missing = hrefKey.split('\n').filter((h) => h && !targets[h]);
    if (!missing.length) return;
    let cancelled = false;
    resolveLinkTargetsAction(missing)
      .then((map) => !cancelled && setTargets((t) => ({ ...t, ...map })))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hrefKey]);

  // focus the label of an item that was just added (or needs a label)
  useEffect(() => {
    if (!focusKey.current) return;
    const el = document.getElementById(`menu-label-${focusKey.current}`) as HTMLInputElement | null;
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.focus({ preventScroll: true });
      focusKey.current = null;
    }
  });

  const edit = (next: Node[]) => {
    setTree(next);
    setFlash(null);
    setError(null);
  };

  const expandPath = (key: string, includeSelf = true) => {
    const path = pathTo(tree, key) ?? [];
    setExpanded((s) => new Set([...s, ...path, ...(includeSelf ? [key] : [])]));
  };

  const ctx: Ctx = {
    location,
    maxDepth,
    tree,
    targets,
    expanded,
    toggleExpanded: (key) =>
      setExpanded((s) => {
        const next = new Set(s);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    update: (key, patch) => edit(updateNode(tree, key, patch)),
    reorder: (parentKey, children) => edit(setChildren(tree, parentKey, children)),
    addChild: (parentKey, spacer = false) => {
      const node: Node = { key: newKey(), id: null, label: '', href: '', enabled: true, newColumn: true, spacer, children: [] };
      const siblings = parentKey == null ? tree : findNode(tree, parentKey)?.children ?? [];
      edit(setChildren(tree, parentKey, [...siblings, node]));
      setExpanded((s) => new Set([...s, ...(parentKey ? [parentKey] : []), ...(spacer ? [] : [node.key])]));
      if (!spacer) focusKey.current = node.key;
    },
    move: (key, toParentKey) => {
      const node = findNode(tree, key);
      const target = findNode(tree, toParentKey);
      if (!node || !target) return;
      const without = removeNode(tree, key);
      const parent = findNode(without, toParentKey);
      edit(setChildren(without, toParentKey, [...(parent?.children ?? []), node]));
      setExpanded((s) => new Set([...s, toParentKey, ...(pathTo(tree, toParentKey) ?? [])]));
      window.setTimeout(() => document.getElementById(`menu-item-${key}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
    },
    askRemove: (node) => setRemoving(node),
    showMissing,
  };

  const save = () => {
    const missing = firstMissingLabel(tree);
    if (missing) {
      setShowMissing(true);
      setError('Every item needs a label (except empty rows).');
      toast.error(SAVE_ERROR_TOAST);
      expandPath(missing.key);
      focusKey.current = missing.key;
      return;
    }
    setError(null);
    setShowMissing(false);
    startSaving(async () => {
      const res = await saveMenuAction(location, toInput(tree));
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const fresh = fromInput(res.tree);
      setTree(fresh);
      setBaseline(snapshot(fresh));
      setFlash('Saved. The store is updated.');
      toast.success('Menu saved');
    });
  };

  const addTopLabel = location === 'MAIN' ? 'Add top menu item' : location === 'FOOTER_SEO' ? 'Add group' : 'Add link';

  return (
    <div className="space-y-4">
      {flash && <Notice tone="success">{flash}</Notice>}
      {tree.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center text-sm text-gray-500">
          This menu is empty.
        </div>
      ) : (
        <Level ctx={ctx} nodes={tree} parentKey={null} depth={0} />
      )}
      <button
        type="button"
        onClick={() => ctx.addChild(null)}
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-dashed border-gray-400 bg-white px-4 text-sm font-semibold text-gray-700 hover:border-brand-400 hover:text-brand-700"
      >
        + {addTopLabel}
      </button>

      <ConfirmDialog
        open={removing != null}
        title={`Remove “${removing?.spacer ? 'empty row' : removing?.label || 'this item'}”?`}
        consequences={removing && removing.children.length ? [`Also removes its ${countDescendants(removing)} link${countDescendants(removing) === 1 ? '' : 's'}`] : []}
        confirmLabel="Remove"
        tone="danger"
        note="Removed when you save."
        onConfirm={() => {
          if (removing) edit(removeNode(tree, removing.key));
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />

      <UnsavedChangesGuard dirty={dirty && !saving} />
      <StickySaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        status="All changes saved"
        actions={[
          ...(dirty
            ? [
                {
                  label: 'Undo all changes',
                  shortLabel: 'Undo',
                  variant: 'secondary' as const,
                  type: 'button' as const,
                  onClick: () => {
                    edit(fromInput(JSON.parse(baseline) as MenuNodeInput[]));
                    toast.info('Changes undone');
                  },
                },
              ]
            : []),
          { label: 'Save menu', type: 'button', onClick: save, disabled: !dirty },
        ]}
      />
    </div>
  );
}

function Level({ ctx, nodes, parentKey, depth }: { ctx: Ctx; nodes: Node[]; parentKey: string | null; depth: number }) {
  return (
    <SortableList
      items={nodes}
      getKey={(n) => n.key}
      onReorder={(items) => ctx.reorder(parentKey, items)}
      ariaLabel={depth === 0 ? 'Menu items' : 'Links inside'}
      renderItem={(node, ctl) => <ItemRow ctx={ctx} node={node} depth={depth} index={ctl.index} handle={ctl.handle} arrows={ctl.arrows} parentKey={parentKey} />}
    />
  );
}

function ItemRow({
  ctx,
  node,
  depth,
  index,
  handle,
  arrows,
  parentKey,
}: {
  ctx: Ctx;
  node: Node;
  depth: number;
  index: number;
  handle: React.ReactNode;
  arrows: React.ReactNode;
  parentKey: string | null;
}) {
  const { location, maxDepth } = ctx;
  const open = ctx.expanded.has(node.key) && !node.spacer;
  const canNest = !node.spacer && depth + 1 < maxDepth;
  const isSeoGroup = location === 'FOOTER_SEO' && depth === 0;
  const target = node.href ? ctx.targets[node.href] : undefined;
  const subtitle = node.spacer
    ? 'Adds space in the dropdown'
    : isSeoGroup
      ? `${node.children.length} link${node.children.length === 1 ? '' : 's'}`
      : node.href
        ? linkTargetText(target, node.href)
        : node.children.length
          ? `${node.children.length} link${node.children.length === 1 ? '' : 's'} inside`
          : 'No link (shown as plain text)';
  const showNewColumn = location === 'MAIN' && depth === 1 && node.children.length > 0 && index > 0;
  const parents = depth > 0 ? nodesAtDepth(ctx.tree, depth - 1) : [];

  return (
    <div
      id={`menu-item-${node.key}`}
      data-testid="menu-item"
      data-label={node.label}
      className={`scroll-mt-24 rounded-xl border bg-white ${depth === 0 ? 'border-gray-200 shadow-sm' : 'border-gray-200'} ${node.enabled ? '' : 'bg-gray-50'}`}
    >
      <div className="flex items-center gap-1 p-1.5 pr-2">
        {handle}
        <button
          type="button"
          onClick={() => !node.spacer && ctx.toggleExpanded(node.key)}
          aria-expanded={node.spacer ? undefined : open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-gray-50"
        >
          {!node.spacer && (
            <span aria-hidden className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}>
              ▸
            </span>
          )}
          <span className="min-w-0">
            <span className={`block truncate text-sm font-semibold ${node.spacer ? 'italic text-gray-400' : node.label ? 'text-ink-dark' : ctx.showMissing ? 'text-red-600' : 'text-gray-500'}`}>
              {node.spacer ? '— empty row —' : node.label || (ctx.showMissing ? 'New item (needs a label)' : 'New item')}
            </span>
            <span className={`block truncate text-xs ${target?.missing ? 'font-medium text-red-600' : 'text-gray-500'}`}>
              {target?.missing && '⚠ '}
              {subtitle}
            </span>
          </span>
        </button>
        {!node.enabled && <span className="hidden shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600 min-[400px]:inline">Hidden</span>}
        {showNewColumn && !node.newColumn && (
          <span className="hidden shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 sm:inline">Same column</span>
        )}
        {arrows}
        <button
          type="button"
          onClick={() => ctx.askRemove(node)}
          aria-label={`Remove ${node.spacer ? 'empty row' : `“${node.label}”`}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <TrashIcon className="h-[18px] w-[18px]" />
        </button>
      </div>

      {node.spacer && (
        <div className="border-t border-gray-100 px-3 py-2">
          <ToggleSwitch label="Show" checked={node.enabled} onChange={(v) => ctx.update(node.key, { enabled: v })} />
        </div>
      )}

      {open && (
        <div className="space-y-4 border-t border-gray-100 px-3 pb-3 pt-3 sm:px-4">
          {/* a plain "Link" here would just repeat the Link field's own heading */}
          {levelName(location, depth) !== 'Link' && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{levelName(location, depth)}</p>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={`menu-label-${node.key}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Label
              </label>
              <input
                id={`menu-label-${node.key}`}
                value={node.label}
                maxLength={80}
                onChange={(e) => ctx.update(node.key, { label: e.target.value })}
                placeholder={isSeoGroup ? 'e.g. Shop furniture by room' : 'e.g. Sofas'}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2 ${
                  node.label.trim() || !ctx.showMissing ? 'border-gray-300 focus:border-brand focus:ring-brand/20' : 'border-red-300 focus:border-red-400 focus:ring-red-100'
                }`}
              />
              {!node.label.trim() && ctx.showMissing && <p className="mt-1 text-xs font-medium text-red-600">A label is required.</p>}
            </div>
            {isSeoGroup ? (
              <p className="self-end text-xs text-gray-500">Group titles are shown as plain text, without a link.</p>
            ) : (
              <LinkPicker
                value={node.href}
                onChange={(href, picked) =>
                  // an empty label takes the name of the page / collection picked, so the owner needn't retype it
                  ctx.update(node.key, !node.label.trim() && picked && autoLabel(picked) ? { href, label: autoLabel(picked) } : { href })
                }
                initialTarget={target}
                label="Link"
                hint={node.children.length ? 'Optional for items with links inside.' : 'Where this item goes. “No link” shows it as plain text.'}
              />
            )}
          </div>

          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <ToggleSwitch label="Show" hint="Turn off to hide it on the store without deleting it." checked={node.enabled} onChange={(v) => ctx.update(node.key, { enabled: v })} />
            {showNewColumn && (
              <div className="max-w-sm">
                <CheckboxField
                  label="Start a new column in the dropdown"
                  hint="Untick to show this group under the previous one in the same column."
                  checked={node.newColumn}
                  onChange={(v) => ctx.update(node.key, { newColumn: v })}
                />
              </div>
            )}
          </div>

          {parents.length > 1 && (
            <div className="max-w-md">
              <label htmlFor={`menu-move-${node.key}`} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Move to…
              </label>
              <select
                id={`menu-move-${node.key}`}
                value={parentKey ?? ''}
                onChange={(e) => e.target.value && e.target.value !== parentKey && ctx.move(node.key, e.target.value)}
                className="min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                {parents.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.path}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">Moves this item (and its links) to the end of another group.</p>
            </div>
          )}

          {canNest && (
            <div className="space-y-2">
              {node.children.length > 0 && (
                <div className="space-y-2 border-l-2 border-gray-100 pl-2 sm:pl-4">
                  <Level ctx={ctx} nodes={node.children} parentKey={node.key} depth={depth + 1} />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => ctx.addChild(node.key)}
                  className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  + Add link inside
                </button>
                {location === 'MAIN' && depth === 0 && (
                  <button
                    type="button"
                    onClick={() => ctx.addChild(node.key, true)}
                    className="inline-flex min-h-10 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    + Add empty row
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
