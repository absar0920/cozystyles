import type { MenuNode } from '@/lib/queries';

/**
 * MAIN menu encoding (see scripts/fidelity/global.ts):
 * - level-2 node WITH children  = a column heading group
 * - level-2 node WITHOUT children = a plain link (flat dropdown)
 * - badge "STACK" on a heading  = render in the same column, below the previous group
 * - blank label                 = an empty 30px spacer row
 */
export const STACK_BADGE = 'STACK';

export type MenuGroup = { heading: MenuNode | null; links: MenuNode[] };

export function isSpacer(node: MenuNode): boolean {
  return node.label.trim() === '';
}

/** Splits a top-level item's children into 25%-wide columns of groups. */
export function megaColumns(item: MenuNode): MenuGroup[][] {
  const columns: MenuGroup[][] = [];
  let flat: MenuGroup | null = null;
  for (const child of item.children) {
    if (child.children.length > 0) {
      flat = null;
      const group: MenuGroup = { heading: child, links: child.children };
      if (child.badge === STACK_BADGE && columns.length > 0) columns[columns.length - 1].push(group);
      else columns.push([group]);
    } else {
      if (!flat) {
        flat = { heading: null, links: [] };
        columns.push([flat]);
      }
      flat.links.push(child);
    }
  }
  return columns;
}
