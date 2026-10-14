import type { Metadata } from 'next';
import Link from 'next/link';
import { listBlogPosts } from '@/lib/queries';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { ChevronRight } from '@/components/icons';
import { blogExcerpt, coverImage, formatDate } from '@/components/pages/content';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'News & Stories',
  description:
    'Interior design ideas, buying guides, seasonal looks and company news from Cozy Furnitures.',
};

export default async function BlogsPage() {
  const posts = await listBlogPosts(50);
  const [featured, ...rest] = posts;
  const featuredImage = featured ? coverImage(featured.bodyHtml) : null;

  return (
    <div className="container-iw space-y-8 py-8 sm:space-y-10 sm:py-10">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'News & Stories' }]} />

      {/* Page header */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 px-6 py-10 sm:px-10 sm:py-14">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-200">Cozy Journal</p>
          <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl lg:text-5xl">News &amp; Stories</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/80 sm:text-base">
            Interior ideas, buying guides, seasonal inspirations and updates from Pakistan&rsquo;s largest furniture
            manufacturer — {posts.length} {posts.length === 1 ? 'story' : 'stories'} and counting.
          </p>
        </div>
      </section>

      {posts.length === 0 && (
        <div className="rounded-2xl border border-cream-border bg-white px-6 py-16 text-center">
          <h2 className="text-lg font-bold text-ink-dark">No stories published yet</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Check back soon — fresh ideas for bedrooms, living rooms and workspaces are on the way.
          </p>
          <Link href="/" className="btn-primary mt-6">
            Continue Shopping
          </Link>
        </div>
      )}

      {/* Featured story */}
      {featured && (
        <article>
          <h2 className="sr-only">Featured story</h2>
          <Link
            href={`/blogs/news/${featured.handle.slice(5)}`}
            className="group grid overflow-hidden rounded-2xl border border-cream-border bg-white shadow-card transition hover:shadow-hover sm:grid-cols-2"
          >
            <div className="aspect-[16/10] overflow-hidden bg-cream sm:aspect-auto sm:min-h-[320px]">
              {featuredImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={featuredImage}
                  alt={featured.title}
                  width={960}
                  height={600}
                  loading="eager"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full min-h-[220px] items-center justify-center bg-gradient-to-br from-brand-50 to-cream">
                  <span className="font-heading text-4xl font-bold text-brand/30">IW</span>
                </div>
              )}
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-10">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-brand px-3 py-1 font-bold uppercase tracking-wider text-white">
                  Featured
                </span>
                <span className="font-medium text-ink-muted">{formatDate(featured.createdAt)}</span>
              </div>
              <h3 className="mt-3 font-heading text-xl font-bold leading-snug text-ink-dark transition group-hover:text-brand sm:text-2xl">
                {featured.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{blogExcerpt(featured.bodyHtml, 220)}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                Read Article
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </Link>
        </article>
      )}

      {/* Story grid */}
      {rest.length > 0 && (
        <section aria-label="All stories">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-ink-muted sm:mb-5">Latest Stories</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => {
              const image = coverImage(post.bodyHtml);
              return (
                <Link
                  key={post.id}
                  href={`/blogs/news/${post.handle.slice(5)}`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-cream-border bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-hover"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-cream">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={post.title}
                        width={640}
                        height={400}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50 to-cream">
                        <span className="font-heading text-3xl font-bold text-brand/30">IW</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-xs font-medium text-ink-muted">{formatDate(post.createdAt)}</p>
                    <h3 className="mt-1.5 font-heading text-base font-bold leading-snug text-ink-dark transition group-hover:text-brand">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">
                      {blogExcerpt(post.bodyHtml, 140)}
                    </p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-brand">
                      Read Article
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
