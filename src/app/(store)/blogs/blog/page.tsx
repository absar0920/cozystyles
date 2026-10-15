import type { Metadata } from 'next';
import { BlogIndex } from '@/components/pages/BlogIndex';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Blog' };

/** Live /blogs/blog is a real but empty blog: "Home / Blog" breadcrumb, "Blog Posts" header, no posts. */
export default function BlogBlogPage() {
  return <BlogIndex page={1} blog="blog" />;
}
