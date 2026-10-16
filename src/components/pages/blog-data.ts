import { prisma } from '@/lib/db';
import { blogSlug } from '@/lib/page-kinds';
import { slugify } from '@/lib/slug';
import { articleExcerpt, decodeEntities, storedRichText, type ArticleImage, type ArticleTag } from './content';

/**
 * Blog posts (`Page.kind = 'BLOG'`) for the storefront: date, author, featured image and tags are their own
 * fields; the body is rich text, sanitised on render. SPEC §5.3.4.
 */

/**
 * Stored tags are comma separated labels. Labels that share a tag page (e.g. "Living Room" and "living-room")
 * are one tag: the first label wins.
 */
export function splitTags(tags: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags.split(',')) {
    const label = raw.trim();
    const key = slugify(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

export function tagHref(label: string): string {
  return `/blogs/news/tagged/${slugify(label)}`;
}

/** Published posts, newest first (date, then creation time). */
export async function listPublishedPosts() {
  return prisma.page.findMany({
    where: { kind: 'BLOG', published: true },
    orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  });
}

type PostRow = Awaited<ReturnType<typeof listPublishedPosts>>[number];

export type BlogPostView = {
  id: number;
  handle: string;
  href: string;
  title: string;
  date: Date;
  author: string | null;
  image: ArticleImage | null;
  tags: ArticleTag[];
  /** sanitised body */
  contentHtml: string;
  excerpt: string;
};

export function toPostView(post: PostRow): BlogPostView {
  const title = decodeEntities(post.title);
  const contentHtml = storedRichText(post.bodyHtml);
  return {
    id: post.id,
    handle: post.handle,
    href: `/blogs/news/${blogSlug(post.handle)}`,
    title,
    date: post.publishedAt ?? post.createdAt,
    author: post.author.trim() || null,
    image: post.featuredImage
      ? { src: post.featuredImage, width: post.featuredImageWidth ?? 1920, height: post.featuredImageHeight ?? 800, alt: title }
      : null,
    tags: splitTags(post.tags).map((label) => ({ label, href: tagHref(label) })),
    contentHtml,
    excerpt: articleExcerpt(contentHtml),
  };
}

export async function loadBlogPosts(): Promise<BlogPostView[]> {
  return (await listPublishedPosts()).map(toPostView);
}

/** Distinct tags of the given posts, A–Z (the blog's tag filter). */
export function distinctTags(posts: BlogPostView[]): ArticleTag[] {
  const byHref = new Map<string, ArticleTag>();
  for (const p of posts) for (const t of p.tags) if (!byHref.has(t.href)) byHref.set(t.href, t);
  return [...byHref.values()].sort((a, b) => a.label.localeCompare(b.label, 'en', { sensitivity: 'base' }));
}
