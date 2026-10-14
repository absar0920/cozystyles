import { AdminCard, Field, Select, TextArea, TextInput } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { saveProductAction } from '@/app/admin/actions/catalog';
import { TitleSlugFields } from './TitleSlugFields';
import { VariantsEditor, type VariantInit } from './VariantsEditor';
import { ImagesEditor, type ImageInit } from './ImagesEditor';

export type CollectionRow = {
  id: number;
  title: string;
  depth: number;
};

export type ProductFormValues = {
  id: number;
  title: string;
  handle: string;
  status: string;
  hot: boolean;
  vendor: string;
  productType: string;
  tags: string;
  bodyHtml: string;
  options: string;
  variants: VariantInit[];
  images: ImageInit[];
  collectionIds: number[];
};

/** Flatten the collection parent/child graph into DFS order with a depth for indenting checkboxes. */
export function buildCollectionTree(
  collections: { id: number; title: string; parentId: number | null }[],
): CollectionRow[] {
  const byId = new Map(
    collections.map((c) => [c.id, { id: c.id, title: c.title, parentId: c.parentId, childIds: [] as number[] }]),
  );
  const rootIds: number[] = [];
  for (const c of collections) {
    const parent = c.parentId != null ? byId.get(c.parentId) : undefined;
    if (parent && parent.id !== c.id) parent.childIds.push(c.id);
    else rootIds.push(c.id);
  }
  const rows: CollectionRow[] = [];
  const seen = new Set<number>(); // guards against corrupted parent loops
  const visit = (id: number, depth: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id)!;
    rows.push({ id: node.id, title: node.title, depth });
    for (const childId of node.childIds) visit(childId, depth + 1);
  };
  for (const rootId of rootIds) visit(rootId, 0);
  return rows;
}

/** Full product create/edit form. Posts straight to the saveProductAction server action. */
export function ProductForm({
  product,
  collectionTree,
  createMode = false,
  error,
  saved,
}: {
  product: ProductFormValues | null;
  collectionTree: CollectionRow[];
  createMode?: boolean;
  error?: string;
  saved?: boolean;
}) {
  const p = product;
  return (
    <form action={saveProductAction} className="space-y-5">
      {p && <input type="hidden" name="id" value={p.id} />}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" role="status">
          Product saved successfully.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          <AdminCard title="Basics">
            <TitleSlugFields auto={createMode} initialTitle={p?.title ?? ''} initialHandle={p?.handle ?? ''} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Status">
                <Select name="status" defaultValue={p?.status ?? 'ACTIVE'}>
                  <option value="ACTIVE">Active (visible in store)</option>
                  <option value="DRAFT">Draft</option>
                  <option value="ARCHIVED">Archived</option>
                </Select>
              </Field>
              <Field label="Vendor">
                <TextInput name="vendor" defaultValue={p?.vendor ?? 'Cozy Furnitures'} />
              </Field>
              <Field label="Product type">
                <TextInput name="productType" defaultValue={p?.productType ?? ''} placeholder="e.g. Sofa, Chair, Storage" />
              </Field>
              <Field label="Tags" hint="Comma separated, e.g. office, ergonomic">
                <TextInput name="tags" defaultValue={p?.tags ?? ''} />
              </Field>
            </div>
            <label className="mt-4 flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-ink-dark">
              <input
                type="checkbox"
                name="hot"
                defaultChecked={p?.hot ?? false}
                className="h-4 w-4 accent-amber-500"
              />
              Hot product (shows the star badge)
            </label>
          </AdminCard>

          <AdminCard title="Description (HTML)">
            <TextArea
              name="bodyHtml"
              rows={12}
              defaultValue={p?.bodyHtml ?? ''}
              className="font-mono text-xs leading-relaxed"
              placeholder="<p>Product description in HTML…</p>"
            />
          </AdminCard>

          <AdminCard title="Variants">
            <VariantsEditor initial={p?.variants} />
          </AdminCard>

          <AdminCard title="Images">
            <ImagesEditor initial={p?.images} />
          </AdminCard>
        </div>

        {/* Sidebar column */}
        <div className="space-y-5">
          <AdminCard title="Collections">
            <p className="mb-2 text-xs text-gray-400">Checked collections show this product.</p>
            <div className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-3 text-sm">
              {collectionTree.map((row) => (
                <label
                  key={row.id}
                  className={`flex cursor-pointer items-center gap-2 ${
                    row.depth === 0 ? 'font-semibold text-ink-dark' : 'text-gray-600'
                  }`}
                  style={{ marginLeft: `${row.depth * 16}px` }}
                >
                  <input
                    type="checkbox"
                    name="collectionIds"
                    value={row.id}
                    defaultChecked={p?.collectionIds.includes(row.id) ?? false}
                    className="h-4 w-4 shrink-0 accent-brand"
                  />
                  <span className="truncate">{row.title}</span>
                </label>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="Options (JSON)">
            <TextArea
              name="options"
              rows={5}
              defaultValue={p?.options || '[]'}
              className="font-mono text-xs leading-relaxed"
            />
            <p className="mt-1.5 text-xs text-gray-400">
              Format: <span className="font-mono">{'[{"name":"Size","values":["2-Seater","3-Seater"]}]'}</span> or <span className="font-mono">[]</span>
            </p>
          </AdminCard>

          <div className="flex flex-wrap items-center gap-2">
            <SubmitButton>{createMode ? 'Create product' : 'Save product'}</SubmitButton>
            <a
              href="/admin/products"
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Cancel
            </a>
          </div>
        </div>
      </div>
    </form>
  );
}
