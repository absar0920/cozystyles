import { Fragment } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getProductByHandle, getReviewsForProduct } from '@/lib/queries';
import { SITE } from '@/lib/constants';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { ProductMain } from '@/components/product/ProductMain';
import { JudgeReviews } from '@/components/product/JudgeReviews';
import { CardRow, StaticSection } from '@/components/product/TemplateSections';
import { ShareFacebookIcon, SharePinterestIcon, ShareTwitterIcon } from '@/components/product/icons';
import {
  getFeaturedCards,
  getLayoutSections,
  getLayoutSectionsForPreview,
  getRecommendations,
  type FeaturedCollectionSection,
  type PdpSection,
} from '@/components/product/pdp-data';
import type { ProductImageInfo, ProductOption, SwatchMap, VariantInfo } from '@/components/product/types';
import { richTextToPlainText, sanitizeRichText } from '@/lib/rich-text/sanitize';
import { NEUTRAL_SWATCH, isSwatchOptionName } from '@/lib/product-options';
import { schemaAvailability } from '@/lib/variant-status';
import { getWhatsAppConfig } from '@/lib/whatsapp-server';
import { getAdminOrNull } from '@/lib/admin-guard';
import { LayoutPreviewBar } from '@/components/product/LayoutPreviewBar';

export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ variant?: string; layoutPreview?: string }>;
};

/** `?layoutPreview=<token>` is honoured only for a signed-in admin (docs/product-layouts/SPEC.md §6.2). */
async function previewToken(searchParams: Params['searchParams']): Promise<string | null> {
  const { layoutPreview } = await searchParams;
  if (typeof layoutPreview !== 'string' || !layoutPreview) return null;
  return (await getAdminOrNull()) ? layoutPreview : null;
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const { handle } = await params;
  const preview = await previewToken(searchParams);
  const product = await getProductByHandle(handle);
  if (!product || (product.status !== 'ACTIVE' && !preview)) return { title: 'Product Not Found' };
  const description =
    richTextToPlainText(product.bodyHtml).slice(0, 160) || `${product.title} — buy online at ${SITE.name}, ${SITE.tagline}.`;
  return {
    title: product.title,
    description,
    ...(preview ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function ProductPage({ params, searchParams }: Params) {
  const { handle } = await params;
  const { variant: variantParam } = await searchParams;
  const preview = await previewToken(searchParams);
  const product = await getProductByHandle(handle);
  // Admin previews may show drafts.
  if (!product || (product.status !== 'ACTIVE' && !preview)) notFound();

  const previewData = preview ? await getLayoutSectionsForPreview(preview) : null;
  const sections: PdpSection[] = previewData?.sections ?? (await getLayoutSections(product.layout));
  const collectionHandles = product.collections.map((c) => c.handle);
  const [reviews, recommendations, featured, whatsapp] = await Promise.all([
    getReviewsForProduct(product.id),
    sections.some((s) => s.kind === 'recommendations') ? getRecommendations(product.id, collectionHandles, 4) : [],
    Promise.all(
      sections
        .filter((s): s is FeaturedCollectionSection => s.kind === 'featuredCollection')
        .map(async (s) => ({ s, cards: await getFeaturedCards(s, product.id) })),
    ),
    getWhatsAppConfig(),
  ]);

  const options: ProductOption[] = product.productOptions.map((o) => ({ name: o.name, values: o.values.map((v) => v.value) }));
  const optionIndexById = new Map(product.productOptions.map((o, i) => [o.id, i]));
  const swatches: SwatchMap = Object.fromEntries(
    product.productOptions
      .map((o, i) => [o, i] as const)
      .filter(([o]) => isSwatchOptionName(o.name))
      .map(([o, i]) => [i, Object.fromEntries(o.values.map((v) => [v.value, { color: v.swatchColor ?? NEUTRAL_SWATCH, image: v.swatchImage }]))]),
  );
  const variants: VariantInfo[] = product.variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: v.sku,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    status: v.status,
    option1: v.option1,
    option2: v.option2,
    option3: v.option3,
  }));
  const images: ProductImageInfo[] = product.images.map((img) => {
    const optionIndex = img.optionValue ? optionIndexById.get(img.optionValue.optionId) : undefined;
    return {
      src: img.src,
      alt: img.alt || product.title,
      tag: img.optionValue && optionIndex != null ? { optionIndex, value: img.optionValue.value } : null,
    };
  });
  const bodyHtml = sanitizeRichText(product.bodyHtml);
  const plainBody = richTextToPlainText(bodyHtml);
  const requestedVariant = Number(variantParam);
  const initialVariantId = variants.some((v) => v.id === requestedVariant) ? requestedVariant : null;
  const lowestPrice = variants.length ? Math.min(...variants.map((v) => v.price)) : 0;

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const pageUrl = `${proto}://${host}/products/${product.handle}`;
  const share = [
    { label: 'Share', Icon: ShareFacebookIcon, iconWidth: 'w-4', href: `https://www.facebook.com/sharer.php?u=${encodeURIComponent(pageUrl)}` },
    {
      label: 'Tweet',
      Icon: ShareTwitterIcon,
      iconWidth: 'w-[19.2px]',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(product.title)}&url=${encodeURIComponent(pageUrl)}`,
    },
    {
      label: 'Pin it',
      Icon: SharePinterestIcon,
      iconWidth: 'w-[15.1px]',
      href: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(pageUrl)}&media=${encodeURIComponent(
        images[0] ? new URL(images[0].src, pageUrl).toString() : '',
      )}&description=${encodeURIComponent(product.title)}`,
    },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: plainBody.slice(0, 320) || undefined,
    image: images.slice(0, 4).map((i) => i.src),
    sku: variants[0]?.sku ?? undefined,
    brand: { '@type': 'Brand', name: product.vendor || SITE.name },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'PKR',
      price: lowestPrice,
      availability: schemaAvailability(variants.map((v) => v.status)),
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/<\//g, '<\\/') }}
      />

      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: product.title }]} className="w-auto" />

      <ProductMain
        product={{
          id: product.id,
          handle: product.handle,
          title: product.title,
          images,
          options,
          variants,
          swatches,
          initialVariantId,
          isNew: product.isNew,
          deliveryLine: product.deliveryTime || null,
        }}
        whatsapp={whatsapp}
      >
        {bodyHtml.trim() && (
          <div
            className="mb-[25px] text-[15px] leading-[26.25px] text-accent [&_h2]:mb-5 [&_h2]:inline-block [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:leading-[23.4px] [&_h3]:mb-[10px] [&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:leading-[23.4px] [&_li]:leading-[25.5px] [&_ol]:mb-[10px] [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-[10px] [&_p]:leading-[25.5px] [&_strong]:font-medium [&_ul]:mb-[10px] [&_ul]:ml-5 [&_ul]:list-disc [&_a]:underline [&_img]:h-auto [&_img]:max-w-full [&_table]:w-full"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )}
        {/* inline-flex links separated by whitespace, like live (adds ~3.4px between items) */}
        <aside className="mb-[25px] mt-[15px] text-[13px] leading-[13px]">
          {share.map(({ label, Icon, iconWidth, href }) => (
            <Fragment key={label}>
              <a href={href} target="_blank" rel="noopener noreferrer" className="mr-[25px] inline-flex items-center text-accent">
                <Icon className={`mr-[10px] block h-4 ${iconWidth}`} />
                {label}
              </a>{' '}
            </Fragment>
          ))}
        </aside>
      </ProductMain>

      {sections.map((s) => {
        if (s.kind === 'recommendations') {
          return <CardRow key={s.id} heading="You may also like" cards={recommendations} variant="recommendations" />;
        }
        if (s.kind === 'featuredCollection') {
          const f = featured.find((x) => x.s === s);
          return <CardRow key={s.id} heading={s.heading} cards={f?.cards ?? []} variant="featured" />;
        }
        if (s.kind === 'reviews') {
          return (
            <JudgeReviews
              key={s.id}
              productId={product.id}
              reviews={reviews.map((r) => ({
                id: r.id,
                author: r.author,
                rating: r.rating,
                title: r.title,
                body: r.body,
                // imported reviews whose date the old widget didn't give are stored at 1970-01-01: shown without a date
                createdAt: r.createdAt.getTime() > 0 ? r.createdAt.toISOString() : '',
              }))}
            />
          );
        }
        return <StaticSection key={s.id} s={s} />;
      })}
      {/* last, so its sticky-bottom position holds for the whole page (see LayoutPreviewBar) */}
      {preview && <LayoutPreviewBar expired={!previewData} layoutId={previewData?.layoutId ?? null} />}
    </>
  );
}
