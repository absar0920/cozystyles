import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPageByHandle } from '@/lib/queries';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { ChevronLeft } from '@/components/icons';
import { blogExcerpt, decodeEntities } from '@/components/pages/content';

export const dynamic = 'force-dynamic';

type PageParams = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { handle } = await params;
  const post = await getPageByHandle(`news-${handle}`);
  if (!post || !post.published || !post.isBlogPost) return { title: 'Article not found' };
  const title = decodeEntities(post.seoTitle?.trim() || post.title);
  const description = post.seoDescription?.trim() || blogExcerpt(post.bodyHtml, 160);
  return {
    title,
    ...(description ? { description: description.slice(0, 160) } : {}),
  };
}

export default async function BlogPostPage({ params }: { params: PageParams }) {
  const { handle } = await params;
  const post = await getPageByHandle(`news-${handle}`);
  if (!post || !post.published || !post.isBlogPost) notFound();

  const title = decodeEntities(post.title);

  return (
    <article className="container-iw py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { label: 'Home', href: '/' },
          { label: 'News & Stories', href: '/blogs' },
          { label: title },
        ]}
        className="mb-5 sm:mb-7"
      />

      <header className="mx-auto mb-8 max-w-3xl sm:mb-10">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-brand px-3 py-1 font-bold uppercase tracking-wider text-white">News</span>
          <span className="font-medium text-ink-muted">
            {new Intl.DateTimeFormat('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            }).format(post.createdAt)}
          </span>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-ink-dark sm:text-3xl lg:text-4xl">{title}</h1>
      </header>

      <div className="rte mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />

      <div className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-4 border-t border-cream-border pt-8">
        <p className="text-sm text-ink-muted">Enjoyed this story? Explore more from the Interwood Journal.</p>
        <Link href="/blogs" className="btn-outline">
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back to News &amp; Stories
        </Link>
      </div>
    </article>
  );
}
