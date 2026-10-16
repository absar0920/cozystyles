import { prisma } from '@/lib/db';
import { countLinkReferences } from '@/lib/link-references';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What deleting a collection takes with it (SPEC §5.2.1). */
export async function collectionDeleteConsequences(c: {
  id: number;
  handle: string;
  image: string | null;
  indexCard: { id: number } | null;
  _count: { products: number; children: number };
}): Promise<string[]> {
  const [refs, layoutSections] = await Promise.all([
    countLinkReferences([`/collections/${c.handle}`], { collectionId: c.id }),
    prisma.productLayoutSection.count({ where: { collectionId: c.id, kind: 'featuredCollection' } }),
  ]);
  const out: string[] = [];
  if (c._count.products) out.push(`${plural(c._count.products, 'product')} ${c._count.products === 1 ? 'stays' : 'stay'} in the catalogue but ${c._count.products === 1 ? 'leaves' : 'leave'} this collection`);
  if (c._count.children) out.push(`${plural(c._count.children, 'sub-collection')} ${c._count.children === 1 ? 'moves' : 'move'} to the top level`);
  if (refs.menuItems) out.push(`${plural(refs.menuItems, 'menu link')} ${refs.menuItems === 1 ? 'points' : 'point'} here and will stop working`);
  if (refs.banners + refs.settings) out.push(`${plural(refs.banners + refs.settings, 'banner or announcement link')} ${refs.banners + refs.settings === 1 ? 'points' : 'point'} here and will stop working`);
  if (refs.richText) out.push(`${plural(refs.richText, 'link')} in pages, descriptions or product page layouts ${refs.richText === 1 ? 'points' : 'point'} here; those links will stop working`);
  if (layoutSections) out.push(`Used in ${plural(layoutSections, '“Products from a collection” section')} of product page layouts (${layoutSections === 1 ? 'it' : 'they'} will disappear from the store)`);
  if (c.indexCard) out.push('Removed from the Collections page');
  if (c.image?.startsWith('/uploads/')) out.push('Its uploaded cover is deleted if not used elsewhere');
  return out;
}

