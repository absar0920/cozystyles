import type { CollectionRow } from './types';

/** Flatten the collection parent/child graph into DFS order (titles A–Z) with a depth for indenting. */
export function buildCollectionTree(collections: { id: number; title: string; parentId: number | null }[]): CollectionRow[] {
  const sorted = [...collections].sort((a, b) => a.title.localeCompare(b.title) || a.id - b.id);
  const byId = new Map(sorted.map((c) => [c.id, { ...c, childIds: [] as number[] }]));
  const rootIds: number[] = [];
  for (const c of sorted) {
    const parent = c.parentId != null ? byId.get(c.parentId) : undefined;
    if (parent && parent.id !== c.id) parent.childIds.push(c.id);
    else rootIds.push(c.id);
  }
  const rows: CollectionRow[] = [];
  const seen = new Set<number>(); // guards against corrupted parent loops
  const visit = (id: number, depth: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id)!;
    rows.push({ id: node.id, title: node.title, depth });
    for (const childId of node.childIds) visit(childId, depth + 1);
  };
  for (const rootId of rootIds) visit(rootId, 0);
  // anything only reachable through a loop
  for (const c of sorted) if (!seen.has(c.id)) visit(c.id, 0);
  return rows;
}
