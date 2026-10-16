'use client';

import { CollectionPicker } from '@/components/admin/CollectionPicker';
import { Select, TextInput } from '@/components/admin/ui';
import { MAX_HEADING } from '@/lib/product-layout-draft';
import type { FeaturedLimit } from '@/lib/product-layout-sections';
import { EditorField, FieldError, inputError, type SectionEditorProps } from './common';

/** "Products from a collection" (SPEC §3.6). */
export function FeaturedEditor({ section, setValues, errors, collections, addCollection }: SectionEditorProps<'featuredCollection'>) {
  const v = section.values;
  const set = (p: Partial<typeof v>) => setValues((cur) => ({ ...cur, ...p }));
  const k = section.key;
  const picked = v.collectionId != null && collections[v.collectionId] ? { id: v.collectionId, title: collections[v.collectionId].title } : null;
  return (
    <div className="grid gap-4">
      <EditorField label="Heading" field="heading" error={errors.heading} htmlFor={`${k}-heading`}>
        <TextInput id={`${k}-heading`} value={v.heading} maxLength={MAX_HEADING} showCount onChange={(e) => set({ heading: e.target.value })} className={inputError(errors.heading)} />
      </EditorField>
      <div data-field="collection">
        <CollectionPicker
          label="Collection"
          required
          value={picked}
          missing={v.collectionId == null && section.base.from !== 'new'}
          error={errors.collection}
          hint="Shows the products of this collection (except the product being viewed)."
          onChange={(c) => {
            addCollection(c.id, c.title, c.products ?? 0);
            // a migrated "no limit" row gets the default limit once its collection changes
            setValues((cur) => ({ ...cur, collectionId: c.id, limit: cur.limit ?? 8 }));
          }}
        />
      </div>
      <EditorField label="How many products" field="limit" htmlFor={`${k}-limit`}>
        <Select
          id={`${k}-limit`}
          value={v.limit == null ? 'all' : String(v.limit)}
          onChange={(e) => set({ limit: e.target.value === 'all' ? null : (Number(e.target.value) as FeaturedLimit) })}
        >
          {v.limit == null && <option value="all">All of them (as now)</option>}
          <option value="4">4</option>
          <option value="8">8</option>
          <option value="12">12</option>
        </Select>
      </EditorField>
      <FieldError message={errors.limit} />
    </div>
  );
}
