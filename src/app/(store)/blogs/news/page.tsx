import type { Metadata } from 'next';
import { BlogIndex } from '@/components/pages/BlogIndex';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'News',
  description: 'Interior design ideas, buying guides, seasonal looks and company news from Cozy Furnitures.',
};

type SearchParams = Promise<{ page?: string }>;

export default async function BlogNewsPage({ searchParams }: { searchParams: SearchParams }) {
  const { page } = await searchParams;
  return <BlogIndex page={Number(page) || 1} />;
}
