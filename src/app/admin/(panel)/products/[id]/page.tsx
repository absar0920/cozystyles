import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { AdminPageHeader } from '@/components/admin/ui';
import { deleteProductAction } from '@/app/admin/actions/catalog';
import { ConfirmSubmit } from '../../_catalog/ConfirmSubmit';
import { ProductForm, buildCollectionTree } from '../_components/ProductForm';

export const dynamic = 'force-dynamic';

/** Pretty-print stored options JSON for the editor (falls back to raw). */
function prettyOptions(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const productId = Number(id);

  const error = typeof sp.error === 'string' ? sp.error : undefined;
  const saved = sp.saved === '1';

  const [product, collections] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
        images: { orderBy: [{ position: 'asc' }, { id: 'asc' }] },
        collections: { select: { id: true } },
      },
    }),
    prisma.collection.findMany({
      orderBy: [{ position: 'asc' }, { title: 'asc' }],
      select: { id: true, title: true, parentId: true },
    }),
  ]);
  if (!product) notFound();

  return (
    <div>
      <AdminPageHeader
        title={product.title}
        subtitle={`Editing /products/${product.handle}`}
        actions={
          <>
            <a
              href={`/products/${product.handle}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              View on store ↗
            </a>
            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={product.id} />
              <ConfirmSubmit
                message={`Delete “${product.title}”? This also removes its variants, images and reviews.`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </ConfirmSubmit>
            </form>
          </>
        }
      />

      <ProductForm
        collectionTree={buildCollectionTree(collections)}
        createMode={false}
        error={error}
        saved={saved}
        product={{
          id: product.id,
          title: product.title,
          handle: product.handle,
          status: product.status,
          hot: product.hot,
          vendor: product.vendor,
          productType: product.productType,
          tags: product.tags,
          bodyHtml: product.bodyHtml,
          options: prettyOptions(product.options || '[]'),
          variants: product.variants,
          images: product.images,
          collectionIds: product.collections.map((c) => c.id),
        }}
      />

      <div className="mt-4">
        <Link href="/admin/products" className="text-sm font-semibold text-brand hover:text-brand-600">
          ← Back to products
        </Link>
      </div>
    </div>
  );
}
