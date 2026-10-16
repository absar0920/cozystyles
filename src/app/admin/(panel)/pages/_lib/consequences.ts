import { countLinkReferences } from '@/lib/link-references';
import { pagePublicPath } from '@/lib/page-kinds';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Delete-confirmation bullets for a TEXT page or a blog post: what is lost and which links break. */
export async function deleteConsequences(page: { id: number; kind: string; handle: string }): Promise<string[]> {
  const refs = await countLinkReferences([pagePublicPath(page)], { pageId: page.id });
  const out = [page.kind === 'BLOG' ? 'The post, its text and its featured photo' : 'The page and its text'];
  if (refs.menuItems > 0) {
    out.push(`${plural(refs.menuItems, 'menu link points', 'menu links point')} here and will stop working`);
  }
  if (refs.banners > 0) out.push(`${plural(refs.banners, 'banner links', 'banners link')} here and will stop working`);
  if (refs.richText > 0) out.push(`${plural(refs.richText, 'page or description links', 'pages or descriptions link')} here`);
  if (refs.settings > 0) out.push('The announcement bar or another store setting links here');
  return out;
}
