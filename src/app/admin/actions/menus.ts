'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/admin-guard';
import { normalizeHref, validateHref } from '@/lib/links';
import { loadMenuTree, maxDepthFor, type MenuNodeInput } from '@/app/admin/(panel)/menus/_lib/tree';

/** Menus (SPEC §5.5): the whole tree of one menu is saved at once. */

// MenuNodeInput is imported from menus/_lib/tree, not re-exported here: Turbopack turns a type re-export in a
// 'use server' module into a runtime reference that breaks every action in the file.

export type SaveMenuResult = { ok: true; tree: MenuNodeInput[] } | { ok: false; error: string };

const MAX_LABEL = 80;
const MAX_ITEMS = 600;

export async function saveMenuAction(location: string, items: MenuNodeInput[]): Promise<SaveMenuResult> {
  await requireAdmin();

  const maxDepth = maxDepthFor(location);
  if (!maxDepth) return { ok: false, error: 'Unknown menu.' };
  if (!Array.isArray(items)) return { ok: false, error: 'The menu could not be read.' };

  const existing = await prisma.menuItem.findMany({ where: { location }, select: { id: true } });
  const ownIds = new Set(existing.map((r) => r.id));
  const seen = new Set<number>();
  let count = 0;

  // ---- validate the whole tree first (nothing is written when anything is wrong)
  type Clean = { id: number | null; label: string; href: string; enabled: boolean; newColumn: boolean; children: Clean[] };
  const problems: string[] = [];
  const clean = (nodes: unknown, depth: number, where: string): Clean[] => {
    if (!Array.isArray(nodes)) {
      problems.push('The menu could not be read.');
      return [];
    }
    return nodes.map((raw, i): Clean => {
      const n = (raw ?? {}) as Partial<MenuNodeInput>;
      count++;
      const id = typeof n.id === 'number' && Number.isInteger(n.id) ? n.id : null;
      if (id != null) {
        if (!ownIds.has(id)) problems.push('Some items were deleted or moved somewhere else. Reload the page and try again.');
        if (seen.has(id)) problems.push('An item appears twice. Reload the page and try again.');
        seen.add(id);
      }
      const spacer = n.spacer === true;
      const label = String(n.label ?? '').replace(/\s+/g, ' ').trim();
      const pos = `${where}item ${i + 1}`;
      const children = Array.isArray(n.children) ? n.children : [];

      if (depth >= maxDepth) problems.push(`“${label || pos}” is nested too deep for this menu.`);
      if (spacer) {
        if (!(location === 'MAIN' && depth === 1)) problems.push('Empty rows are only allowed inside a main menu dropdown.');
        if (children.length) problems.push('An empty row cannot have links inside.');
        return { id, label: '', href: '', enabled: n.enabled !== false, newColumn: true, children: [] };
      }
      if (!label) problems.push(`Please give ${pos} a label.`);
      if (label.length > MAX_LABEL) problems.push(`“${label.slice(0, 30)}…” is longer than ${MAX_LABEL} characters.`);

      // FOOTER_SEO group titles have no link
      let href = location === 'FOOTER_SEO' && depth === 0 ? '' : normalizeHref(String(n.href ?? ''));
      const hrefError = validateHref(href, { allowEmpty: true });
      if (hrefError) problems.push(`“${label}”: ${hrefError}`);
      if (href.length > 500) href = href.slice(0, 500);

      return {
        id,
        label,
        href,
        enabled: n.enabled !== false,
        newColumn: location === 'MAIN' && depth === 1 ? n.newColumn !== false : true,
        children: clean(children, depth + 1, label ? `“${label}” › ` : ''),
      };
    });
  };
  const tree = clean(items, 0, '');
  if (count > MAX_ITEMS) problems.push(`A menu can have at most ${MAX_ITEMS} items.`);
  if (problems.length) return { ok: false, error: problems[0] };

  // ---- write: update or create every item in order, then delete the ones that were removed
  await prisma.$transaction(
    async (tx) => {
      const keep = new Set<number>();
      const write = async (nodes: Clean[], parentId: number | null) => {
        for (let position = 0; position < nodes.length; position++) {
          const n = nodes[position];
          const data = { label: n.label, href: n.href, enabled: n.enabled, newColumn: n.newColumn, parentId, position, location };
          const id = n.id != null ? (await tx.menuItem.update({ where: { id: n.id }, data, select: { id: true } })).id
            : (await tx.menuItem.create({ data, select: { id: true } })).id;
          keep.add(id);
          await write(n.children, id);
        }
      };
      await write(tree, null);
      const removed = [...ownIds].filter((id) => !keep.has(id));
      if (removed.length) await tx.menuItem.deleteMany({ where: { id: { in: removed }, location } });
    },
    { timeout: 30_000 },
  );

  revalidatePath('/admin/menus');
  revalidatePath('/', 'layout');
  return { ok: true, tree: await loadMenuTree(location) };
}
