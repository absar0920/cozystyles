import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BlogIndex } from '@/components/pages/BlogIndex';
import { BLOG_TAGS } from '@/components/pages/content';

export const dynamic = 'force-dynamic';

type Params = Promise<{ tag: string }>;
type SearchParams = Promise<{ page?: string }>;

function findTag(tag: string) {
  return BLOG_TAGS.find((t) => t.href === `/blogs/news/tagged/${tag}`);
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { tag } = await params;
  return { title: `News — ${findTag(tag)?.label ?? tag}` };
}

export default async function BlogTaggedPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ tag }, { page }] = await Promise.all([params, searchParams]);
  if (!findTag(tag)) notFound();
  return <BlogIndex page={Number(page) || 1} tag={tag} />;
}
