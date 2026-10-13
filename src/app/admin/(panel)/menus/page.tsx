import type { Metadata } from 'next';
import Link from 'next/link';
import type { MenuItem } from '@prisma/client';
import { prisma } from '@/lib/db';
import { saveMenuItemAction, toggleMenuItemAction, deleteMenuItemAction } from '@/app/admin/actions/content';
import { AdminCard, AdminPageHeader, Field, Select, TextInput } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { ChevronDown, PlusIcon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Menus',
  robots: { index: false, follow: false },
};

const MENU_LOCATIONS = [
  { value: 'MAIN', label: 'Main navigation', hint: 'The header menu — items can be nested up to two levels deep.' },
  { value: 'TOPBAR', label: 'Top bar', hint: 'Thin utility strip rendered above the main header.' },
  { value: 'FOOTER_1', label: 'Footer — column 1', hint: 'First column of links in the footer.' },
  { value: 'FOOTER_2', label: 'Footer — column 2', hint: 'Second column of links in the footer.' },
  { value: 'FOOTER_3', label: 'Footer — column 3', hint: 'Third column of links in the footer.' },
] as const;

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50';

type MenuNode = { item: MenuItem; children: MenuNode[] };
type FlatOption = { id: number; label: string; depth: number };

/** Valid locations guard (searchParams are untrusted strings). */
function isLocation(value: unknown): value is string {
  return typeof value === 'string' && MENU_LOCATIONS.some((l) => l.value === value);
}

export default async function MenusPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const location = isLocation(sp.location) ? sp.location : 'MAIN';
  const saved = sp.saved === '1';
  const deletedCount = Number.parseInt(typeof sp.deleted === 'string' ? sp.deleted : '', 10);

  const [grouped, items] = await Promise.all([
    prisma.menuItem.groupBy({ by: ['location'], _count: { _all: true } }),
    prisma.menuItem.findMany({
      where: { location },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    }),
  ]);

  const countFor = (loc: string) => grouped.find((g) => g.location === loc)?._count._all ?? 0;

  // Build the tree; items whose parent is missing (or outside this location) float to the root.
  const ids = new Set(items.map((i) => i.id));
  const childrenOf = (parentId: number): MenuNode[] =>
    items
      .filter((i) => i.parentId === parentId)
      .map((item) => ({ item, children: childrenOf(item.id) }));
  const roots = items
    .filter((i) => i.parentId == null || !ids.has(i.parentId))
    .map((item) => ({ item, children: childrenOf(item.id) }));

  const meta = MENU_LOCATIONS.find((l) => l.value === location) ?? MENU_LOCATIONS[0];
  // Parents are limited to the first two levels: the header mega-menu renders two nested levels,
  // and it keeps each <select> small (the MAIN menu holds 100+ links).
  const allOptions = flatten(roots).filter((o) => o.depth <= 1);
  const getOptions = (excludeId: number) => flatten(roots, excludeId).filter((o) => o.depth <= 1);
  const nextPosition = items.filter((i) => i.parentId == null).length;

  return (
    <div>
      <AdminPageHeader
        title="Menus"
        subtitle="Navigation links for the header, top bar and footer columns"
      />

      {saved && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Menu saved. Storefront navigation updated.
        </div>
      )}
      {Number.isFinite(deletedCount) && deletedCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Deleted {deletedCount} item{deletedCount === 1 ? '' : 's'}
          {deletedCount > 1 ? ' (including its sub-items)' : ''}.
        </div>
      )}

      {/* ------------------------------------------------------- location tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {MENU_LOCATIONS.map((l) => {
          const active = l.value === location;
          return (
            <Link
              key={l.value}
              href={`/admin/menus?location=${l.value}`}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                active ? 'bg-brand-900 text-white' : 'border border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {l.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {countFor(l.value)}
              </span>
            </Link>
          );
        })}
      </div>

      {/* -------------------------------------------------------- add new item */}
      <div className="mb-6">
        <AdminCard title={`Add a link to “${meta.label}”`}>
          <form action={saveMenuItemAction} className="space-y-4">
            <input type="hidden" name="location" value={location} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Label">
                <TextInput name="label" required placeholder="Bedroom" />
              </Field>
              <Field label="Link" hint="Internal path (/collections/bedroom) or full https:// URL.">
                <TextInput name="href" placeholder="/collections/bedroom" />
              </Field>
              <Field label="Badge" hint="Optional highlight, e.g. NEW or SALE.">
                <TextInput name="badge" placeholder="NEW" />
              </Field>
              <Field label="Position" hint="Lower numbers show first.">
                <TextInput name="position" type="number" defaultValue={nextPosition} />
              </Field>
              <Field label="Parent" hint="Top-level links show in the bar; nesting is limited to two levels.">
                <Select name="parentId" defaultValue="">
                  <option value="">— Top level —</option>
                  {allOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {'— '.repeat(o.depth)}
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-sm text-ink">
                  <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4 rounded border-gray-300 accent-brand" />
                  Enabled (visible)
                </label>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-100 pt-4">
              <SubmitButton>
                <PlusIcon className="h-4 w-4" /> Add item
              </SubmitButton>
            </div>
          </form>
        </AdminCard>
      </div>

      {/* ------------------------------------------------------------- the tree */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-base font-bold text-ink-dark">
          {meta.label}
          <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
            {items.length}
          </span>
        </h2>
        <p className="text-xs text-gray-400">{meta.hint}</p>
      </div>

      {roots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white/60 px-6 py-10 text-center text-sm text-gray-400">
          No links in this menu yet — add the first one above.
        </div>
      ) : (
        <div className="space-y-2">
          {roots.map((node) => (
            <MenuNodeRow key={node.item.id} node={node} location={location} getOptions={getOptions} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ tree rows */

function MenuNodeRow({
  node,
  location,
  getOptions,
}: {
  node: MenuNode;
  location: string;
  getOptions: (excludeId: number) => FlatOption[];
}) {
  const { item, children } = node;

  return (
    <div id={`item-${item.id}`} className="scroll-mt-24">
      <details className="group rounded-xl border border-gray-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition hover:bg-gray-50/70 [&::-webkit-details-marker]:hidden">
          <span className={`text-sm ${item.enabled ? 'font-semibold text-ink-dark' : 'font-medium text-gray-400 line-through'}`}>
            {item.label}
          </span>
          {item.badge && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              {item.badge}
            </span>
          )}
          <a
            href={item.href}
            target="_blank"
            rel="noopener"
            className="max-w-[220px] truncate font-mono text-xs text-brand hover:underline"
            title={item.href}
          >
            {item.href}
          </a>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">#{item.position}</span>
          {!item.enabled && (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500">Hidden</span>
          )}
          {children.length > 0 && (
            <span className="text-xs text-gray-400">
              {children.length} sub-item{children.length === 1 ? '' : 's'}
            </span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
        </summary>

        <div className="border-t border-gray-100 bg-gray-50/60 p-4">
          <form action={saveMenuItemAction} className="space-y-4">
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="location" value={location} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Label">
                <TextInput name="label" defaultValue={item.label} required />
              </Field>
              <Field label="Link">
                <TextInput name="href" defaultValue={item.href} />
              </Field>
              <Field label="Badge">
                <TextInput name="badge" defaultValue={item.badge ?? ''} placeholder="—" />
              </Field>
              <Field label="Position">
                <TextInput name="position" type="number" defaultValue={item.position} />
              </Field>
              <Field label="Parent">
                <Select name="parentId" defaultValue={item.parentId ?? ''}>
                  <option value="">— Top level —</option>
                  {getOptions(item.id).map((o) => (
                    <option key={o.id} value={o.id}>
                      {'— '.repeat(o.depth)}
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-end">
                <label className="inline-flex cursor-pointer items-center gap-2 pb-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="enabled"
                    defaultChecked={item.enabled}
                    className="h-4 w-4 rounded border-gray-300 accent-brand"
                  />
                  Enabled (visible)
                </label>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-100 pt-4">
              <SubmitButton>Save item</SubmitButton>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-200/70 pt-3">
            <form action={toggleMenuItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <button type="submit" className={ghostBtn}>
                {item.enabled ? 'Hide' : 'Show'}
              </button>
            </form>
            <details className="relative inline-block text-left">
              <summary className="inline-flex cursor-pointer select-none items-center rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 [&::-webkit-details-marker]:hidden">
                Delete
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                <p className="text-xs text-gray-500">
                  Permanently delete “{item.label}”?
                  {children.length > 0 && <> Its {children.length} sub-item{children.length === 1 ? '' : 's'} will be deleted too.</>}
                </p>
                <form action={deleteMenuItemAction} className="mt-2">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="w-full rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    Yes, delete permanently
                  </button>
                </form>
              </div>
            </details>
          </div>
        </div>
      </details>

      {children.length > 0 && (
        <div className="mt-2 ml-2 space-y-2 border-l-2 border-gray-200 pl-3 sm:ml-3 sm:pl-4">
          {children.map((child) => (
            <MenuNodeRow key={child.item.id} node={child} location={location} getOptions={getOptions} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

/** Depth-first flatten of the tree; when `excludeId` is given that entire subtree is skipped. */
function flatten(nodes: MenuNode[], excludeId?: number): FlatOption[] {
  const out: FlatOption[] = [];
  const walk = (list: MenuNode[], depth: number) => {
    for (const n of list) {
      if (excludeId != null && n.item.id === excludeId) continue;
      out.push({ id: n.item.id, label: n.item.label, depth });
      walk(n.children, depth + 1);
    }
  };
  walk(nodes, 0);
  return out;
}
