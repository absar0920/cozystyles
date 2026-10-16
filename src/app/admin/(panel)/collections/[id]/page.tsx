import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { sanitizeRichText } from '@/lib/rich-text/sanitize';
import { AdminPageHeader } from '@/components/admin/ui';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { deleteCollectionAction } from '@/app/admin/actions/collections';
import { CollectionForm } from '../_components/CollectionForm';
import { collectionDeleteConsequences } from '../_lib/consequences';

export const dynamic = 'force-dynamic';

/** Edit an existing collection, or create a new one when the id segment is "new". */
export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isNew = id === 'new';
  if (!isNew && !/^\d+$/.test(id)) notFound();
  const collectionId = isNew ? null : Number(id);

  const [collection, allCollections, products] = await Promise.all([
    collectionId != null
      ? prisma.collection.findUnique({
          where: { id: collectionId },
          include: {
            products: { select: { id: true } },
            indexCard: { select: { id: true } },
            _count: { select: { products: true, children: true } },
          },
        })
      : Promise.resolve(null),
    prisma.collection.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true } }),
    prisma.product.findMany({ orderBy: { title: 'asc' }, select: { id: true, title: true, status: true } }),
  ]);
  if (!isNew && !collection) notFound();

  const consequences = collection ? await collectionDeleteConsequences(collection) : [];

  return (
    <div className="pb-28">
      <div className="mb-3">
        <Link href="/admin/collections" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand hover:text-brand-600">
          ← Collections
        </Link>
      </div>
      <AdminPageHeader
        title={collection ? collection.title : 'New collection'}
        subtitle={collection ? undefined : 'Group products so customers can browse them together'}
        actions={
          collection ? (
            <>
              <ViewOnStoreLink href={`/collections/${collection.handle}`} />
              <ConfirmDelete
                action={deleteCollectionAction}
                fields={{ id: String(collection.id) }}
                title={`Delete “${collection.title}”?`}
                consequences={consequences}
              />
            </>
          ) : (
            <ViewOnStoreLink href={null} disabledReason="Save to see it on the store" />
          )
        }
      />

      <CollectionForm
        key={collection ? `c${collection.id}` : 'new'}
        parentOptions={allCollections.filter((c) => c.id !== collection?.id)}
        products={products}
        initial={{
          id: collection?.id ?? null,
          title: collection?.title ?? '',
          handle: collection?.handle ?? '',
          description: sanitizeRichText(collection?.description ?? ''),
          image: collection?.image ?? '',
          parentId: collection?.parentId != null ? String(collection.parentId) : '',
          productIds: collection?.products.map((p) => p.id) ?? [],
          showOnIndex: collection ? !!collection.indexCard : true,
        }}
      />
    </div>
  );
}
