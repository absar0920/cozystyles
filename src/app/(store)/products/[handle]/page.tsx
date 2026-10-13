import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProductByHandle, getRelatedProducts, getReviewsForProduct } from '@/lib/queries';
import { SITE } from '@/lib/constants';
import { ChevronRight, PhoneIcon, ShieldIcon, TruckIcon } from '@/components/icons';
import { Stars } from '@/components/ui/Stars';
import { ProductCard } from '@/components/catalog/ProductCard';
import { Gallery } from '@/components/product/Gallery';
import { ProductBuyPanel } from '@/components/product/ProductBuyPanel';
import { ProductAccordion } from '@/components/product/ProductAccordion';
import { ReviewsSection } from '@/components/product/ReviewsSection';
import type { ProductOption, VariantInfo } from '@/components/product/types';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ handle: string }> };

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOptions(json: string): ProductOption[] {
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((o): o is { name: string; values: string[] } => !!o && typeof o.name === 'string' && Array.isArray(o.values))
      .map((o) => ({ name: o.name, values: o.values.filter((v): v is string => typeof v === 'string') }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product || product.status !== 'ACTIVE') return { title: `Product Not Found | ${SITE.name}` };
  const description =
    stripHtml(product.bodyHtml).slice(0, 160) || `${product.title} — buy online at ${SITE.name}, ${SITE.tagline}.`;
  return {
    title: `${product.title} | ${SITE.name}`,
    description,
  };
}

export default async function ProductPage({ params }: Params) {
  const { handle } = await params;
  const product = await getProductByHandle(handle);
  if (!product || product.status !== 'ACTIVE') notFound();

  const [reviews, related] = await Promise.all([
    getReviewsForProduct(product.id),
    getRelatedProducts(product.id, product.collections.map((c) => c.handle), 8),
  ]);

  const options = parseOptions(product.options);
  const variants: VariantInfo[] = product.variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    inventory: v.inventory,
    option1: v.option1,
    option2: v.option2,
    option3: v.option3,
  }));
  const images = product.images.map((img) => ({ src: img.src, alt: img.alt || product.title }));
  const firstCollection = product.collections[0];
  const lowestPrice = variants.length ? Math.min(...variants.map((v) => v.price)) : 0;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: stripHtml(product.bodyHtml).slice(0, 320) || undefined,
    image: images.slice(0, 4).map((i) => i.src),
    sku: variants[0]?.sku ?? undefined,
    brand: { '@type': 'Brand', name: product.vendor || SITE.name },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'PKR',
      price: lowestPrice,
      availability: variants.some((v) => v.inventory > 0)
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      url: `/products/${product.handle}`,
    },
    ...(product.reviewCount > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
          },
        }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="container-iw pb-4 pt-5">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-ink-muted">
            <li>
              <Link href="/" className="transition hover:text-brand">
                Home
              </Link>
            </li>
            {firstCollection && (
              <li className="flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 text-ink-light" />
                <Link href={`/collections/${firstCollection.handle}`} className="transition hover:text-brand">
                  {firstCollection.title}
                </Link>
              </li>
            )}
            <li className="flex min-w-0 items-center gap-1.5">
              <ChevronRight className="h-3 w-3 shrink-0 text-ink-light" />
              <span aria-current="page" className="truncate font-medium text-ink-dark" title={product.title}>
                {product.title}
              </span>
            </li>
          </ol>
        </nav>
      </div>

      {/* Product main */}
      <section className="container-iw grid gap-8 pb-8 lg:grid-cols-2 lg:gap-12 lg:pb-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Gallery images={images} title={product.title} />
        </div>

        <div className="flex flex-col">
          {product.productType && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{product.productType}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="font-heading text-2xl font-semibold leading-tight text-ink-dark sm:text-[28px]">
              {product.title}
            </h1>
            {product.hot && (
              <span className="rounded-md bg-terra px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                Best Seller
              </span>
            )}
          </div>

          <a href="#reviews" className="mt-2.5 w-fit transition hover:opacity-80">
            <Stars rating={product.rating} count={product.reviewCount} size="md" />
          </a>

          <div className="my-5 h-px bg-cream-border" />

          <ProductBuyPanel
            product={{
              id: product.id,
              handle: product.handle,
              title: product.title,
              image: images[0]?.src ?? '',
              options,
              variants,
            }}
          />

          {/* Delivery / warranty / helpline strip */}
          <ul className="mt-7 grid gap-3 sm:grid-cols-3">
            <li className="flex items-center gap-3 rounded-xl border border-cream-border bg-cream-soft/70 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                <TruckIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink-dark">Free Delivery</span>
                <span className="block text-[11px] leading-snug text-ink-muted">Delivery &amp; installation nationwide</span>
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-cream-border bg-cream-soft/70 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                <ShieldIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink-dark">1 Year Warranty</span>
                <span className="block text-[11px] leading-snug text-ink-muted">Manufacturer&rsquo;s warranty</span>
              </span>
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-cream-border bg-cream-soft/70 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                <PhoneIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-ink-dark">Helpline</span>
                <span className="block text-[11px] leading-snug text-ink-muted">{SITE.phone}</span>
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* Accordions */}
      <section className="container-iw pb-10">
        <div className="border-t border-cream-border">
          <ProductAccordion title="Description" defaultOpen>
            {product.bodyHtml.trim() ? (
              <div dangerouslySetInnerHTML={{ __html: product.bodyHtml }} />
            ) : (
              <p>
                {product.title} — crafted by {SITE.name}, {SITE.tagline.toLowerCase()}. Premium materials, expert
                workmanship and nationwide delivery with professional installation.
              </p>
            )}
          </ProductAccordion>

          <ProductAccordion title="Delivery & Returns">
            <p>
              <strong>Free Delivery &amp; Installation:</strong> We deliver and install your furniture free of charge
              anywhere in Pakistan. Our own installation teams handle assembly, placement and debris removal so your
              furniture is ready to use from day one.
            </p>
            <p>
              <strong>Lead Times:</strong> In-stock items are typically dispatched within 5–7 working days. Made-to-order
              and customized pieces are manufactured for you and usually ship within 3–4 weeks; our team confirms your
              delivery date on call after you place an order.
            </p>
            <p>
              <strong>Returns:</strong> If a delivered item does not meet your expectations, you may request a return or
              exchange within 7 days of delivery, provided it is unused and in its original condition. Custom-made and
              made-to-order furniture cannot be returned unless there is a manufacturing defect.
            </p>
          </ProductAccordion>

          <ProductAccordion title="Warranty">
            <p>
              All {SITE.name} furniture carries a <strong>1-year manufacturer&rsquo;s warranty</strong> covering defects in
              materials and workmanship under normal domestic use.
            </p>
            <p>
              Imported hardware and fittings (hinges, drawer channels, locks) are additionally covered by their original
              manufacturer&rsquo;s warranty. The warranty does not cover normal wear and tear, misuse, or damage occurring
              after delivery and installation. For warranty claims, contact our helpline at {SITE.phone}.
            </p>
          </ProductAccordion>
        </div>
      </section>

      <div className="border-t border-cream-border bg-cream">
        <ReviewsSection rating={product.rating} reviewCount={product.reviewCount} reviews={reviews} />
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="container-iw border-t border-cream-border py-9 lg:py-12">
          <h2 id="related-heading" className="mb-6 font-heading text-xl font-semibold text-ink-dark sm:text-2xl">
            You May Also Like
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
