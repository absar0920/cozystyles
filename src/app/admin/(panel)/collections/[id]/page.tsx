import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { AdminPageHeader } from '@/components/admin/ui';
import { deleteCollectionAction } from '@/app/admin/actions/catalog';
import { ConfirmSubmit } from '../../_catalog/ConfirmSubmit';
import { CollectionForm } from '../_components/CollectionForm';

export const metadata: Metadata = {
  title: 'Edit collection',
  robots: { index: false, follow: false },
};


export const dynamic = 'force-dynamic';

/** Edit an existing collection, or create a new one when the id segment is "new". */
export default async function EditCollectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const isNew = id === 'new';
  const collectionId = isNew ? null : Number(id);
  if (!isNew && !/^\d+$/.test(id)) notFound();

  const error = typeof sp.error === 'string' ? sp.error : undefined;
  const saved = sp.saved === '1';

  const [collection, allCollections, products] = await Promise.all([
    collectionId != null && Number.isFinite(collectionId)
      ? prisma.collection.findUnique({
          where: { id: collectionId },
          include: { products: { select: { id: true } } },
        })
      : Promise.resolve(null),
    prisma.collection.findMany({ orderBy: [{ position: 'asc' }, { title: 'asc' }], select: { id: true, title: true } }),
    prisma.product.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true, handle: true } }),
  ]);

  if (!isNew && !collection) notFound();

  // A collection can never be its own parent.
  const parentOptions = allCollections.filter((c) => !collection || c.id !== collection.id);

  return (
    <div>
      <AdminPageHeader
        title={isNew ? 'New collection' : collection!.title}
        subtitle={isNew ? 'Group products into a category, room or lookbook' : `Editing /collections/${collection!.handle}`}
        actions={
          <>
            {!isNew && (
              <a
                href={`/collections/${collection!.handle}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                View on store ↗
              </a>
            )}
            {!isNew && (
              <form action={deleteCollectionAction}>
                <input type="hidden" name="id" value={collection!.id} />
                <ConfirmSubmit
                  message={`Delete “${collection!.title}”? Its sub-collections will move to the top level.`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  Delete
                </ConfirmSubmit>
              </form>
            )}
          </>
        }
      />

      <CollectionForm
        createMode={isNew}
        error={error}
        saved={saved}
        parentOptions={parentOptions}
        products={products}
        collection={
          isNew
            ? null
            : {
                id: collection!.id,
                title: collection!.title,
                handle: collection!.handle,
                description: collection!.description,
                image: collection!.image ?? '',
                parentId: collection!.parentId,
                kind: collection!.kind,
                featured: collection!.featured,
                showInNav: collection!.showInNav,
                position: collection!.position,
                productIds: collection!.products.map((p) => p.id),
              }
        }
      />

      <div className="mt-4">
        <Link href="/admin/collections" className="text-sm font-semibold text-brand hover:text-brand-600">
          ← Back to collections
        </Link>
      </div>
    </div>
  );
}
