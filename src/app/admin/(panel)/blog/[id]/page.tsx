import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { findBrokenLinks } from '@/lib/link-targets';
import { blogSlug } from '@/lib/page-kinds';
import { storedRichText } from '@/components/pages/content';
import { BlogPostEditor, type BlogPostEditorData } from '../_components/BlogPostEditor';
import { deleteConsequences } from '../../pages/_lib/consequences';
import { blogSuggestions, splitTags, storeToday } from '../_lib/blog-admin';

import { decodeEntities } from '@/components/pages/content';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit blog post',
  robots: { index: false, follow: false },
};

/** /admin/blog/new creates a post; /admin/blog/<id> edits one. */
export default async function BlogPostEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp, suggestions] = await Promise.all([params, searchParams, blogSuggestions()]);
  const today = storeToday();

  if (id === 'new') {
    return <BlogPostEditor key="new" post={null} today={today} {...suggestions} deleteConsequences={[]} />;
  }

  const postId = Number(id);
  if (!Number.isInteger(postId) || postId <= 0) notFound();
  const post = await prisma.page.findUnique({ where: { id: postId } });
  if (!post) notFound();
  if (post.kind !== 'BLOG') redirect(`/admin/pages/${post.id}`);

  const data: BlogPostEditorData = {
    id: post.id,
    title: decodeEntities(post.title),
    slug: blogSlug(post.handle),
    date: (post.publishedAt ?? post.createdAt).toISOString().slice(0, 10),
    author: post.author,
    featuredImage: post.featuredImage,
    featuredImageWidth: post.featuredImageWidth,
    featuredImageHeight: post.featuredImageHeight,
    bodyHtml: storedRichText(post.bodyHtml),
    tags: splitTags(post.tags),
    seoTitle: post.seoTitle ?? '',
    seoDescription: post.seoDescription ?? '',
    published: post.published,
  };

  return (
    <BlogPostEditor
      key={post.id}
      post={data}
      today={today}
      created={sp.created === '1'}
      {...suggestions}
      deleteConsequences={await deleteConsequences(post)}
      brokenLinks={await findBrokenLinks(data.bodyHtml)}
    />
  );
}
