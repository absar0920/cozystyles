import type { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AdminPageHeader } from '@/components/admin/ui';
import { ProductForm, buildCollectionTree } from '../_components/ProductForm';

export const metadata: Metadata = {
  title: 'New product',
  robots: { index: false, follow: false },
};


export const dynamic = 'force-dynamic';

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === 'string' ? sp.error : undefined;

  const collections = await prisma.collection.findMany({
    orderBy: [{ position: 'asc' }, { title: 'asc' }],
    select: { id: true, title: true, parentId: true },
  });

  return (
    <div>
      <AdminPageHeader
        title="New product"
        subtitle="Create a product with variants, images and collection links"
        actions={
          <Link
            href="/admin/products"
            className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            ← Back to products
          </Link>
        }
      />
      <ProductForm product={null} collectionTree={buildCollectionTree(collections)} createMode error={error} />
    </div>
  );
}
