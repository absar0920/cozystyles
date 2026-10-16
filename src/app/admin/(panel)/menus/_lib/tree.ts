import { prisma } from '@/lib/db';

/** One menu item as the menu editor and saveMenuAction exchange it. */
export type MenuNodeInput = {
  id: number | null;
  label: string;
  href: string;
  enabled: boolean;
  newColumn: boolean;
  spacer: boolean;
  children: MenuNodeInput[];
};

/** Admin tab → stored location, depth (levels the storefront renders) and copy. */
export const MENU_TABS = [
  {
    tab: 'main',
    location: 'MAIN',
    label: 'Main menu',
    maxDepth: 3,
    hint: 'The menu at the top of every page. Items with links inside open a dropdown.',
  },
  {
    tab: 'about',
    location: 'FOOTER_1',
    label: 'Footer “About”',
    maxDepth: 1,
    hint: 'Shown in the website footer under the “Information” heading.',
  },
  {
    tab: 'support',
    location: 'FOOTER_2',
    label: 'Footer “Customer Support”',
    maxDepth: 1,
    hint: 'Shown in the website footer under the “User Area” heading.',
  },
  {
    tab: 'popular',
    location: 'FOOTER_SEO',
    label: 'Footer “Popular searches”',
    maxDepth: 2,
    hint: 'Shown at the bottom of the website footer as groups of links.',
  },
] as const;

export type MenuTab = (typeof MENU_TABS)[number];

export function maxDepthFor(location: string): number {
  return MENU_TABS.find((t) => t.location === location)?.maxDepth ?? 0;
}

type Row = { id: number; label: string; href: string; enabled: boolean; newColumn: boolean; parentId: number | null; position: number };

export function buildMenuTree(rows: Row[]): MenuNodeInput[] {
  const byParent = new Map<number | null, Row[]>();
  for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r]);
  const build = (parentId: number | null): MenuNodeInput[] =>
    (byParent.get(parentId) ?? [])
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map((r) => ({
        id: r.id,
        label: r.label,
        href: r.href,
        enabled: r.enabled,
        newColumn: r.newColumn,
        spacer: r.label.trim() === '' && r.href === '',
        children: build(r.id),
      }));
  return build(null);
}

/** The editable tree of one menu (hidden items included). */
export async function loadMenuTree(location: string): Promise<MenuNodeInput[]> {
  const rows = await prisma.menuItem.findMany({
    where: { location },
    select: { id: true, label: true, href: true, enabled: true, newColumn: true, parentId: true, position: true },
  });
  return buildMenuTree(rows);
}
