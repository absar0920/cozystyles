import type { Metadata } from 'next';
import { BLOG_PER_PAGE, BlogIndex } from '@/components/pages/BlogIndex';
import { canonical, pagedPath } from '@/lib/seo';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ page?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { page } = await searchParams;
  // page 2 onwards is its own page, up to the last one (a higher number shows the last page)
  const wanted = Number(page) || 1;
  const last = wanted > 1 ? Math.max(1, Math.ceil((await prisma.page.count({ where: { kind: 'BLOG', published: true } })) / BLOG_PER_PAGE)) : 1;
  return {
    title: 'News',
    description: 'Interior design ideas, buying guides, seasonal looks and company news from Cozy Furnitures.',
    ...canonical(pagedPath('/blogs/news', Math.min(wanted, last))),
  };
}

export default async function BlogNewsPage({ searchParams }: { searchParams: SearchParams }) {
  const { page } = await searchParams;
  return <BlogIndex page={Number(page) || 1} />;
}
