import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogIndex } from '@/components/pages/BlogIndex';
import { distinctTags, loadBlogPosts } from '@/components/pages/blog-data';

export const dynamic = 'force-dynamic';

type Params = Promise<{ tag: string }>;
type SearchParams = Promise<{ page?: string }>;

/** A tag exists while at least one published post carries it. */
async function findTag(tag: string) {
  return distinctTags(await loadBlogPosts()).find((t) => t.href === `/blogs/news/tagged/${tag}`);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tag } = await params;
  return { title: `News — ${(await findTag(tag))?.label ?? tag}` };
}

export default async function BlogTaggedPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ tag }, { page }] = await Promise.all([params, searchParams]);
  if (!(await findTag(tag))) notFound();
  return <BlogIndex page={Number(page) || 1} tag={tag} />;
}
