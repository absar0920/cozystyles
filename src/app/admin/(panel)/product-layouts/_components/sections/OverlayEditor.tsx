'use client';

import { ImageUpload } from '@/components/admin/ImageUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { BrokenLinksNotice } from '@/components/admin/BrokenLinksNotice';
import { Select, TextInput } from '@/components/admin/ui';
import { HEADING_SIZE_OPTIONS, MAX_OVERLAY_HEADING, MAX_OVERLAY_TEXT, MAX_SUBHEADING } from '@/lib/product-layout-draft';
import type { HeadingSize } from '@/lib/product-layout-sections';
import { EditorField, FieldError, LAYOUT_TEXT_FEATURES, inputError, richTextLength, type SectionEditorProps } from './common';

/** "Big photo with text" (SPEC §3.1). */
export function OverlayEditor({ section, setValues, setBody, errors, addImageMeta, brokenLinks, readOnly }: SectionEditorProps<'overlay'>) {
  const v = section.values;
  const set = (p: Partial<typeof v>) => setValues((cur) => ({ ...cur, ...p }));
  const k = section.key;
  const textLength = richTextLength(section.bodyHtml);
  return (
    <div className="grid gap-4">
      <div data-field="image">
        <ImageUpload
          label="Background photo"
          hint="Shown full width behind the text. Wide photos work best (about 1920 × 600). Keep the middle clear for the text."
          value={v.image || null}
          onChange={(url, meta) => {
            if (url && meta) addImageMeta(url, meta.width, meta.height);
            set({ image: url ?? '' });
          }}
          purpose="layout"
          previewAspect="16 / 5"
          required
          allowRemove={false}
        />
        <FieldError message={errors.image} />
      </div>
      <EditorField label="Small line above the heading (optional)" field="subheading" error={errors.subheading} htmlFor={`${k}-sub`}>
        <TextInput id={`${k}-sub`} value={v.subheading} maxLength={MAX_SUBHEADING} showCount onChange={(e) => set({ subheading: e.target.value })} className={inputError(errors.subheading)} />
      </EditorField>
      <EditorField label="Heading" field="heading" error={errors.heading} htmlFor={`${k}-heading`}>
        <TextInput id={`${k}-heading`} value={v.heading} maxLength={MAX_OVERLAY_HEADING} showCount onChange={(e) => set({ heading: e.target.value })} className={inputError(errors.heading)} />
      </EditorField>
      <EditorField label="Heading size" field="headingClass" htmlFor={`${k}-hsize`}>
        <Select id={`${k}-hsize`} value={v.headingClass} onChange={(e) => set({ headingClass: e.target.value as HeadingSize })}>
          {HEADING_SIZE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </EditorField>
      <div data-field="body">
        <RichTextEditor
          label="Text"
          hint="Keep it short: a sentence or two."
          value={section.bodyHtml}
          onChange={setBody}
          features={LAYOUT_TEXT_FEATURES}
          minHeight={140}
          readOnly={readOnly}
          ariaLabel="Text"
        />
        <p className={`mt-1 text-right text-xs tabular-nums ${textLength > MAX_OVERLAY_TEXT ? 'font-semibold text-amber-600' : 'text-gray-400'}`}>
          {textLength} / {MAX_OVERLAY_TEXT}
        </p>
        <FieldError message={errors.body} />
      </div>
      <BrokenLinksNotice links={brokenLinks} />
    </div>
  );
}
