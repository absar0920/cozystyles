'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { saveCollectionAction, type CollectionFormState } from '@/app/admin/actions/collections';
import { slugify } from '@/lib/slug';
import { CheckboxField, Field, FormError, Notice, SectionCard, Select, TextInput } from '@/components/admin/ui';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { StickySaveBar } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ProductsPicker, type PickerProduct } from './ProductsPicker';

export type CollectionFormValues = {
  id: number | null;
  title: string;
  handle: string;
  description: string;
  image: string;
  parentId: string;
  productIds: number[];
  showOnIndex: boolean;
};

const INITIAL_STATE: CollectionFormState = { ok: false };

/** Collection create/edit form (SPEC §5.2.1). Saves through saveCollectionAction without leaving the page. */
export function CollectionForm({
  initial,
  parentOptions,
  products,
}: {
  initial: CollectionFormValues;
  parentOptions: { id: number; title: string }[];
  products: PickerProduct[];
}) {
  const isNew = initial.id == null;
  const [values, setValues] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [handleTouched, setHandleTouched] = useState(!isNew);
  const [state, formAction, pending] = useActionState(saveCollectionAction, INITIAL_STATE);
  const savedFromUrl = useSearchParams().get('saved') === '1';
  const handled = useRef<number | undefined>(undefined);
  const formId = useId();

  useEffect(() => {
    if (!state.ok || !state.savedAt || state.savedAt === handled.current || !state.saved) return;
    handled.current = state.savedAt;
    const next = { ...values, handle: state.saved.handle, description: state.saved.description };
    setValues(next);
    setBaseline(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const fe = state.ok ? {} : state.fieldErrors ?? {};
  const set = <K extends keyof CollectionFormValues>(key: K, v: CollectionFormValues[K]) => setValues((prev) => ({ ...prev, [key]: v }));

  const onTitle = (title: string) =>
    setValues((prev) => ({ ...prev, title, ...(handleTouched ? {} : { handle: slugify(title) }) }));

  const showSaved = (state.ok || (savedFromUrl && !state.error)) && !dirty;

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-5"
    >
      {initial.id != null && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="productsJson" value={JSON.stringify(values.productIds)} />
      {showSaved && <Notice tone="success">Saved. The store is updated.</Notice>}
      {!state.ok && state.error && <Notice tone="error">{state.error}</Notice>}

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0 space-y-5">
          <SectionCard title="Basics">
            <div className="space-y-5">
              <div>
                <Field label="Name" htmlFor={`${formId}-title`}>
                  <TextInput id={`${formId}-title`} name="title" value={values.title} onChange={(e) => onTitle(e.target.value)} required placeholder="e.g. Living Room" />
                </Field>
                <FormError message={fe.title} />
              </div>
              <RichTextEditor
                name="description"
                value={values.description}
                onChange={(html) => set('description', html)}
                label="Description"
                hint="Shown under the products on the collection page (with “Show more”)."
                minHeight={180}
              />
            </div>
          </SectionCard>

          <SectionCard title="Products in this collection" description="Tick the products that belong here. The order on the store stays as it is.">
            <ProductsPicker products={products} value={values.productIds} onChange={(ids) => set('productIds', ids)} />
            <FormError message={fe.products} />
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-5">
          <SectionCard title="Cover photo">
            <ImageUpload
              name="image"
              value={values.image || null}
              onChange={(url) => set('image', url ?? '')}
              label="Cover photo"
              hint="Shown on the Collections page and the home “Shop by Category” tiles."
              purpose="collection"
              previewAspect="3 / 4"
            />
            <FormError message={fe.image} />
          </SectionCard>

          <SectionCard title="Where it shows">
            <div className="space-y-4">
              <div>
                <Field label="Inside collection (optional)" htmlFor={`${formId}-parent`} hint="Puts this collection under another one, e.g. “Sofas” inside “Living Room”.">
                  <Select id={`${formId}-parent`} name="parentId" value={values.parentId} onChange={(e) => set('parentId', e.target.value)}>
                    <option value="">— Top level —</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <FormError message={fe.parentId} />
              </div>
              <CheckboxField
                name="showOnIndex"
                label="Show on the Collections page"
                hint="Change the order on Collections → Arrange Collections page."
                checked={values.showOnIndex}
                onChange={(v) => set('showOnIndex', v)}
              />
            </div>
          </SectionCard>

          <SectionCard title="Advanced" collapsible defaultOpen={!!fe.handle}>
            <Field label="Web address" htmlFor={`${formId}-handle`} hint={isNew ? 'Made from the name. You can change it.' : undefined}>
              <div className="flex min-w-0 items-center rounded-lg border border-gray-300 bg-gray-50 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
                <span className="hidden shrink-0 pl-3 text-sm text-gray-500 sm:inline">cozyfurnitures.pk/collections/</span>
                <span className="shrink-0 pl-3 text-sm text-gray-500 sm:hidden">…/collections/</span>
                <input
                  id={`${formId}-handle`}
                  name="handle"
                  value={values.handle}
                  onChange={(e) => {
                    setHandleTouched(true);
                    set('handle', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
                  }}
                  onBlur={() => set('handle', slugify(values.handle) || values.handle)}
                  className="min-w-0 flex-1 rounded-r-lg bg-white px-2 py-2 text-sm outline-none"
                />
              </div>
            </Field>
            <FormError message={fe.handle} />
            {!isNew && values.handle !== initial.handle && (
              <p className="mt-2 text-xs font-medium text-amber-700">Changing the web address breaks links that people have saved or shared.</p>
            )}
          </SectionCard>
        </div>
      </div>

      <UnsavedChangesGuard dirty={dirty && !pending} />
      <StickySaveBar
        dirty={dirty}
        saving={pending}
        error={!state.ok ? state.error : null}
        status={isNew ? 'New collection' : 'All changes saved'}
        actions={[{ label: isNew ? 'Create collection' : 'Save collection', shortLabel: isNew ? 'Create' : 'Save', type: 'submit', form: formId, disabled: !isNew && !dirty }]}
      />
    </form>
  );
}
