import { notFound } from 'next/navigation';
import { ProductEditor } from '../_components/ProductEditor';
import { buildCollectionTree } from '../_lib/collections';
import { loadEditorLookups, loadProductEditorState, productDeleteConsequences } from '../_lib/load';

export const dynamic = 'force-dynamic';

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

  const [state, lookups, deleteInfo] = await Promise.all([
    loadProductEditorState(productId),
    loadEditorLookups(),
    productDeleteConsequences(productId),
  ]);
  if (!state) notFound();

  const notice = sp.duplicated === '1' ? 'duplicated' : sp.saved === '1' ? 'saved' : null;
  return (
    <ProductEditor
      key={state.updatedAt}
      initial={state}
      collections={buildCollectionTree(lookups.collections)}
      productTypes={lookups.productTypes}
      layouts={lookups.layouts}
      deleteInfo={deleteInfo}
      notice={notice}
    />
  );
}
