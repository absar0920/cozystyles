'use client';

import { SortableList } from '@/components/admin/SortableList';
import { Select, TextArea, TextInput } from '@/components/admin/ui';
import { MAX_AUTHOR, MAX_HEADING, MAX_QUOTE, MAX_SUBHEADING, QUOTE_SIZE_OPTIONS, type QuoteValues } from '@/lib/product-layout-draft';
import { MAX_TESTIMONIALS, type TestimonialSize } from '@/lib/product-layout-sections';
import { AddButton, EditorField, FieldError, RemoveButton, inputError, itemKey, useUndoRemove, type SectionEditorProps } from './common';

/** "Customer quotes" (SPEC §3.4). */
export function TestimonialsEditor({ section, setValues, errors }: SectionEditorProps<'testimonials'>) {
  const v = section.values;
  const set = (p: Partial<typeof v>) => setValues((cur) => ({ ...cur, ...p }));
  const setItems = (items: QuoteValues[]) => set({ items });
  const patch = (key: string, p: Partial<QuoteValues>) => setValues((cur) => ({ ...cur, items: cur.items.map((q) => (q.key === key ? { ...q, ...p } : q)) }));
  const k = section.key;
  const undo = useUndoRemove<QuoteValues>((update) => setValues((cur) => ({ ...cur, items: update(cur.items) })));
  return (
    <div className="grid gap-4">
      <EditorField label="Small line above the heading (optional)" field="subheading" error={errors.subheading} htmlFor={`${k}-sub`}>
        <TextInput id={`${k}-sub`} value={v.subheading} maxLength={MAX_SUBHEADING} showCount onChange={(e) => set({ subheading: e.target.value })} className={inputError(errors.subheading)} />
      </EditorField>
      <EditorField label="Heading" field="heading" error={errors.heading} htmlFor={`${k}-heading`}>
        <TextInput id={`${k}-heading`} value={v.heading} maxLength={MAX_HEADING} showCount onChange={(e) => set({ heading: e.target.value })} className={inputError(errors.heading)} />
      </EditorField>
      <EditorField label="Quote text size" field="size" htmlFor={`${k}-size`}>
        <Select id={`${k}-size`} value={v.size} onChange={(e) => set({ size: e.target.value as TestimonialSize })}>
          {QUOTE_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </EditorField>

      <div className="grid gap-3" data-field="items">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quotes</p>
        <FieldError message={errors.items} />
        <SortableList
          items={v.items}
          getKey={(q) => q.key}
          onReorder={setItems}
          ariaLabel="Quotes"
          renderItem={(q, ctl) => {
            const qErr = errors[`items.${q.key}.quote`];
            const aErr = errors[`items.${q.key}.author`];
            return (
              <div data-testid="quote-item" className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center">
                    {ctl.handle}
                    <span className="text-sm font-semibold text-gray-700">Quote {ctl.index + 1}</span>
                  </span>
                  <span className="flex items-center">
                    {ctl.arrows}
                    {v.items.length > 1 && <RemoveButton label={`Remove quote ${ctl.index + 1}`} onClick={() => undo.remove(q, ctl.index, `Quote ${ctl.index + 1}`)} />}
                  </span>
                </div>
                <div className="grid gap-3">
                  <EditorField
                    label="Quote"
                    hint="Add quote marks yourself if you want them shown. Press Enter to start a new line."
                    field={`items.${q.key}.quote`}
                    error={qErr}
                    htmlFor={`${q.key}-quote`}
                  >
                    <TextArea
                      id={`${q.key}-quote`}
                      data-plain-text=""
                      rows={3}
                      value={q.quote}
                      maxLength={MAX_QUOTE}
                      showCount
                      onChange={(e) => patch(q.key, { quote: e.target.value })}
                      className={inputError(qErr)}
                    />
                  </EditorField>
                  <EditorField label="Customer name" field={`items.${q.key}.author`} error={aErr} htmlFor={`${q.key}-author`}>
                    <TextInput id={`${q.key}-author`} value={q.author} maxLength={MAX_AUTHOR} onChange={(e) => patch(q.key, { author: e.target.value })} className={inputError(aErr)} />
                  </EditorField>
                </div>
              </div>
            );
          }}
        />
        {undo.notice}
        <AddButton
          onClick={() => setItems([...v.items, { key: itemKey('q'), quote: '', author: '' }])}
          disabled={v.items.length >= MAX_TESTIMONIALS}
          disabledReason={`Customer quotes can have up to ${MAX_TESTIMONIALS} quotes.`}
        >
          + Add quote
        </AddButton>
      </div>
    </div>
  );
}
