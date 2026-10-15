import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPageByHandle, listBlogPosts } from '@/lib/queries';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { ArticleNavigation } from '@/components/pages/ArticleNavigation';
import { ShareArticle } from '@/components/pages/ShareArticle';
import {
  articleHref,
  blogExcerpt,
  cleanBodyHtml,
  decodeEntities,
  formatArticleDate,
  parseArticle,
} from '@/components/pages/content';
import '@/components/pages/content.css';

export const dynamic = 'force-dynamic';

type PageParams = Promise<{ handle: string }>;

async function loadPost(handle: string) {
  const post = await getPageByHandle(`news-${handle}`);
  return post && post.published && post.isBlogPost ? post : null;
}

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { handle } = await params;
  const post = await loadPost(handle);
  if (!post) return { title: 'Page not found' };
  const title = decodeEntities(post.seoTitle?.trim() || post.title);
  const description = post.seoDescription?.trim() || blogExcerpt(post.bodyHtml, 160);
  return { title, ...(description ? { description } : {}) };
}

/** Live template-article: breadcrumb, sticky reading bar, centred meta + title, 1060px image + body, tags, share. */
export default async function BlogPostPage({ params }: { params: PageParams }) {
  const { handle } = await params;
  const post = await loadPost(handle);
  if (!post) notFound();

  const title = decodeEntities(post.title);
  const article = parseArticle(post.bodyHtml);
  const date = article.publishedAt ?? post.createdAt;

  // Live order: "previous" is the newer article, "next" the older one.
  const posts = await listBlogPosts(500);
  const index = posts.findIndex((p) => p.id === post.id);
  const toLink = (p: (typeof posts)[number] | undefined) =>
    p ? { href: articleHref(p.handle), title: decodeEntities(p.title) } : null;
  const prev = index > 0 ? toLink(posts[index - 1]) : null;
  const next = index >= 0 ? toLink(posts[index + 1]) : null;

  return (
    <div className="sf-page sf-article">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'News', href: '/blogs/news' }, { label: title }]} />
      <ArticleNavigation title={title} prev={prev} next={next} targetId="blog-post-detail" />

      <div className="section-spacing">
        {/* flow-root: live's flex column keeps the share bar's 25px margin from collapsing into the section's */}
        <div className="container-iw flow-root">
          <article id="blog-post-detail" className="mx-auto max-w-[1060px]">
            <div className="mx-auto mb-[30px] max-w-[750px] text-center md:mb-[55px]">
              <div className="mb-5 text-[12px] uppercase tracking-title opacity-60">
                <aside className="relative mx-[15px] mb-[10px] inline-flex">
                  <time dateTime={date.toISOString()}>{formatArticleDate(date)}</time>
                  {article.author && (
                    <span
                      aria-hidden
                      className="absolute right-[-15px] top-1/2 -mt-px inline-block h-[2px] w-[2px] rounded-[1px] bg-accent opacity-60"
                    />
                  )}
                </aside>
                {article.author && <aside className="relative mx-[15px] mb-[10px] inline-flex">{article.author}</aside>}
              </div>
              <h1 className="h2 mb-5">{title}</h1>
            </div>

            {article.image && (
              <div className="-mx-[12.5px] mb-[35px] w-[calc(100%+25px)] md:mx-0 md:mb-[65px] md:w-full">
                {/* live serves the `_1060x550_crop_center` rendition */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.image.src}
                  alt={article.image.alt || title}
                  width={1060}
                  height={550}
                  className="block aspect-[1060/550] h-auto w-full object-cover"
                />
              </div>
            )}

            <div
              className="post-content page-content-width rte"
              dangerouslySetInnerHTML={{ __html: cleanBodyHtml(article.contentHtml) }}
            />

            {article.tags.length > 0 && (
              <footer className="pb-10 pt-5 text-[15px]">
                <span className="mr-[5px]">Tags:</span>{' '}
                {article.tags.map((tag, i) => (
                  <span key={tag.href}>
                    <Link href={tag.href} className="text-button !mr-0">
                      {tag.label}
                    </Link>
                    {i < article.tags.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </footer>
            )}

            <ShareArticle path={articleHref(post.handle)} title={title} />
          </article>
        </div>
      </div>
    </div>
  );
}
