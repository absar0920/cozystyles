import { ProductEditor } from '../_components/ProductEditor';
import { buildCollectionTree } from '../_lib/collections';
import { loadEditorLookups, newProductState } from '../_lib/load';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const { collections, productTypes, layouts } = await loadEditorLookups();
  const state = newProductState();
  return <ProductEditor key="new" initial={state} collections={buildCollectionTree(collections)} productTypes={productTypes} layouts={layouts} deleteInfo={null} />;
}
