import { AdminCard, Field, Select, TextArea, TextInput } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { saveCollectionAction } from '@/app/admin/actions/catalog';
import { ImageField } from './ImageField';
import { ProductsPicker, type PickerProduct } from './ProductsPicker';

export type CollectionFormValues = {
  id: number;
  title: string;
  handle: string;
  description: string;
  image: string;
  parentId: number | null;
  kind: string;
  featured: boolean;
  showInNav: boolean;
  position: number;
  productIds: number[];
};

/** Full collection create/edit form. Posts straight to the saveCollectionAction server action. */
export function CollectionForm({
  collection,
  parentOptions,
  products,
  createMode = false,
  error,
  saved,
}: {
  collection: CollectionFormValues | null;
  parentOptions: { id: number; title: string }[];
  products: PickerProduct[];
  createMode?: boolean;
  error?: string;
  saved?: boolean;
}) {
  const c = collection;
  return (
    <form action={saveCollectionAction} className="space-y-5">
      {c && <input type="hidden" name="id" value={c.id} />}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700" role="status">
          Collection saved successfully.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <AdminCard title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title">
                <TextInput name="title" required defaultValue={c?.title ?? ''} placeholder="e.g. Living Room" />
              </Field>
              <Field label="Handle (URL slug)" hint="Auto-generated from the title if left blank.">
                <TextInput name="handle" defaultValue={c?.handle ?? ''} placeholder="living-room" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Description">
                <TextArea name="description" rows={4} defaultValue={c?.description ?? ''} placeholder="Short description shown on the collection page…" />
              </Field>
            </div>
          </AdminCard>

          <AdminCard title="Image">
            <ImageField initial={c?.image ?? ''} />
          </AdminCard>

          <AdminCard title="Organisation">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Parent collection">
                <Select name="parentId" defaultValue={c?.parentId != null ? String(c.parentId) : ''}>
                  <option value="">— None (top level) —</option>
                  {parentOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kind">
                <Select name="kind" defaultValue={c?.kind ?? 'CATEGORY'}>
                  <option value="CATEGORY">Category</option>
                  <option value="ROOM">Room</option>
                  <option value="LOOKBOOK">Lookbook</option>
                  <option value="HELPER">Helper</option>
                </Select>
              </Field>
              <Field label="Position" hint="Lower numbers sort first in nav.">
                <TextInput name="position" type="number" min={0} defaultValue={String(c?.position ?? 0)} />
              </Field>
              <div className="flex flex-col justify-end gap-2 pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-dark">
                  <input type="checkbox" name="showInNav" defaultChecked={c?.showInNav ?? true} className="h-4 w-4 accent-brand" />
                  Show in navigation
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-dark">
                  <input type="checkbox" name="featured" defaultChecked={c?.featured ?? false} className="h-4 w-4 accent-brand" />
                  Featured on homepage
                </label>
              </div>
            </div>
          </AdminCard>
        </div>

        <div>
          <AdminCard title="Products in this collection">
            <p className="mb-3 text-xs text-gray-400">Search and tick the products that belong here.</p>
            <ProductsPicker products={products} initialIds={c?.productIds ?? []} />
          </AdminCard>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton>{createMode ? 'Create collection' : 'Save collection'}</SubmitButton>
        <a
          href="/admin/collections"
          className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
