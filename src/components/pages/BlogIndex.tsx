import Link from 'next/link';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { BlogTagSelect } from './BlogTagSelect';
import { distinctTags, loadBlogPosts } from './blog-data';
import { formatIndexDate, formatLongDate } from './content';
import './content.css';

export const BLOG_PER_PAGE = 9;

/**
 * Live `/blogs/news` (template-blog): breadcrumb, centred header + tag select, 3-up cards, numbered pagination.
 * `blog="blog"` renders live's second, empty blog (`/blogs/blog`): same header, an "All"-only select, no posts.
 */
export async function BlogIndex({ page, tag, blog = 'news' }: { page: number; tag?: string; blog?: 'news' | 'blog' }) {
  const isNews = blog === 'news';
  const all = isNews ? await loadBlogPosts() : [];
  const basePath = tag ? `/blogs/news/tagged/${tag}` : `/blogs/${blog}`;
  const tags = distinctTags(all);
  const posts = tag ? all.filter((p) => p.tags.some((t) => t.href === basePath)) : all;
  const pageCount = Math.max(1, Math.ceil(posts.length / BLOG_PER_PAGE));
  const current = Math.min(Math.max(1, page), pageCount);
  const visible = posts.slice((current - 1) * BLOG_PER_PAGE, current * BLOG_PER_PAGE);
  const tagLabel = tag ? tags.find((t) => t.href === basePath)?.label : undefined;
  const pageHref = (n: number) => (n === 1 ? basePath : `${basePath}?page=${n}`);

  return (
    <div className="sf-page">
      <Breadcrumbs
        items={
          tagLabel
            ? [{ label: 'Home', href: '/' }, { label: 'News', href: '/blogs/news' }, { label: tagLabel }]
            : [{ label: 'Home', href: '/' }, { label: isNews ? 'News' : 'Blog' }]
        }
      />

      <div className="container-iw text-center">
        <div className="mb-5 border-b border-line py-[30px] md:mb-10 md:py-[50px]">
          <h1 className="mb-0 !leading-none">Blog Posts</h1>
          <span className="h4 mt-[10px] block !font-normal opacity-60">{formatLongDate(new Date())}</span>
        </div>
        <div className="mb-5 text-[24px] md:mb-10">
          <BlogTagSelect tags={isNews ? tags : []} current={basePath} allHref={`/blogs/${blog}`} />
        </div>
      </div>

      <div className="mb-[50px] md:mb-[100px]">
        <div className="mx-auto flex max-w-[1360px] flex-wrap px-[5px] md:px-[25px]">
          {visible.map((post) => (
            <div key={post.id} className="w-full px-[7.5px] md:w-1/3 md:px-[15px] lg:px-5">
              <div className="blog-post mb-[60px] text-center">
                <figure
                  className="featured-image relative isolate mb-[35px] h-0 overflow-hidden"
                  style={{ paddingBottom: `${post.image ? (post.image.height / post.image.width) * 100 : 41.667}%` }}
                >
                  <Link href={post.href} className="absolute inset-0 block" aria-label={post.title}>
                    {post.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.image.src}
                        alt={post.title}
                        width={post.image.width}
                        height={post.image.height}
                        loading="lazy"
                        className="block h-full w-full object-cover"
                      />
                    )}
                  </Link>
                </figure>
                <aside className="mb-[10px] text-[12px] uppercase tracking-title opacity-60">
                  {formatIndexDate(post.date)}
                </aside>
                <h5 className="mb-[5px] h-[100px]">
                  <Link href={post.href}>{post.title}</Link>
                </h5>
                <div className="post-excerpt h-[120px] text-[15px] min-[1201px]:h-[105px]">
                  {/* live: unclamped — a 5-line excerpt spills out of the fixed box over READ MORE */}
                  <p>{post.excerpt}</p>
                </div>
                <Link
                  href={post.href}
                  className="read-more relative inline-flex pb-[14px] text-[11px] font-semibold uppercase leading-none tracking-btn"
                >
                  Read more
                </Link>
              </div>
            </div>
          ))}
          {isNews && visible.length === 0 && (
            <p className="w-full px-[7.5px] pb-10 text-center md:px-[15px]">No articles found.</p>
          )}
        </div>

        {pageCount > 1 && (
          <nav aria-label="Pagination" className="min-h-[42px] text-center">
            {/* live: 17px text row (its inter-link spaces are 17px wide), 13px links with line-height 0 */}
            <div className="text-[17px] leading-[1.75]">
              {current > 1 && <PageLink href={pageHref(current - 1)} label="←" />}
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) =>
                n === current ? (
                  <span
                    key={n}
                    aria-current="page"
                    className="mx-[3px] inline-flex h-[42px] w-[42px] items-center justify-center rounded-full border border-accent2 text-[13px] leading-[0] text-accent2"
                  >
                    {n}
                  </span>
                ) : (
                  <PageLink key={n} href={pageHref(n)} label={String(n)} />
                ),
              )}
              {current < pageCount && <PageLink href={pageHref(current + 1)} label="→" />}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}

function PageLink({ href, label }: { href: string; label: string }) {
  return (
    <>
      {' '}
      <Link
        href={href}
        className="mx-[3px] inline-flex h-[42px] w-[42px] items-center justify-center rounded-full border border-accent text-[13px] leading-[0] hover:bg-accent hover:text-white"
      >
        {/* Poppins has no arrows: live falls through to the generic sans-serif (not next/font's metric-adjusted fallback) */}
        {/^\d+$/.test(label) ? label : <span className="[font-family:sans-serif]">{label}</span>}
      </Link>{' '}
    </>
  );
}
