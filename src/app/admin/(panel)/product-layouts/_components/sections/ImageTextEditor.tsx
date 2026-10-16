'use client';

import { ImageUpload } from '@/components/admin/ImageUpload';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { LinkPicker } from '@/components/admin/LinkPicker';
import { BrokenLinksNotice } from '@/components/admin/BrokenLinksNotice';
import { SegmentedControl, Select, TextInput, ToggleSwitch } from '@/components/admin/ui';
import { HEADING_SIZE_OPTIONS, MAX_BUTTON_LABEL, MAX_HEADING, type HeadingStyle } from '@/lib/product-layout-draft';
import type { HeadingSize } from '@/lib/product-layout-sections';
import { EditorField, FieldError, LAYOUT_TEXT_FEATURES, aspectOf, inputError, type SectionEditorProps } from './common';

/** Keeps the photo preview to about a third of a laptop screen, so the settings below it stay in view. */
const PREVIEW_MAX_HEIGHT = 340;

/** "Photo and text" (SPEC §3.2). */
export function ImageTextEditor({ section, setValues, setBody, errors, imageMeta, addImageMeta, linkTargets, brokenLinks, readOnly }: SectionEditorProps<'imageText'>) {
  const v = section.values;
  const set = (p: Partial<typeof v>) => setValues((cur) => ({ ...cur, ...p }));
  const k = section.key;
  // only for new uploads: the bundled photos are the store's current design
  const meta = v.image.startsWith('/uploads/') ? imageMeta[v.image] : undefined;
  const shapeWarning = meta
    ? meta.w < 600
      ? 'This photo is small and may look blurry.'
      : meta.h >= meta.w * 0.9
        ? 'This photo is tall, so this section will be tall. A landscape photo works best.'
        : null
    : null;
  const recommended = v.size === 'large' ? 'about 1462 × 842' : 'about 1268 × 1028';

  return (
    <div className="grid gap-4">
      <div data-field="image">
        <ImageUpload
          label="Photo"
          hint={`The section takes the shape of the photo. Recommended ${recommended}.`}
          value={v.image || null}
          onChange={(url, m) => {
            if (url && m) addImageMeta(url, m.width, m.height);
            set({ image: url ?? '' });
          }}
          purpose="layout"
          previewAspect={aspectOf(imageMeta, v.image, '5 / 4')}
          previewMaxHeight={PREVIEW_MAX_HEIGHT}
          required
          allowRemove={false}
        />
        {shapeWarning && (
          <p data-testid="photo-shape-warning" className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            {shapeWarning}
          </p>
        )}
        <FieldError message={errors.image} />
      </div>

      <SegmentedControl
        label="Photo position"
        hint="On phones the photo is always on top."
        options={[
          { value: 'left', label: 'Photo on the left' },
          { value: 'right', label: 'Photo on the right' },
        ]}
        value={v.imageFirst ? 'left' : 'right'}
        onChange={(p) => set({ imageFirst: p === 'left' })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SegmentedControl
          label="Photo size"
          options={[
            { value: 'medium', label: 'Normal' },
            { value: 'large', label: 'Wide' },
          ]}
          value={v.size}
          onChange={(size) => set({ size })}
        />
        <SegmentedControl
          label="Text alignment"
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Centred' },
          ]}
          value={v.center ? 'center' : 'left'}
          onChange={(a) => set({ center: a === 'center' })}
        />
      </div>

      <EditorField label="Heading" field="heading" error={errors.heading} htmlFor={`${k}-heading`}>
        <TextInput id={`${k}-heading`} value={v.heading} maxLength={MAX_HEADING} showCount onChange={(e) => set({ heading: e.target.value })} className={inputError(errors.heading)} />
      </EditorField>
      <div className="grid gap-4 sm:grid-cols-2">
        <EditorField label="Heading size" field="headingClass" htmlFor={`${k}-hsize`}>
          <Select id={`${k}-hsize`} value={v.headingClass} onChange={(e) => set({ headingClass: e.target.value as HeadingSize })}>
            {HEADING_SIZE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </EditorField>
        <EditorField label="Heading style" field="headingStyle" htmlFor={`${k}-hstyle`}>
          <Select id={`${k}-hstyle`} value={v.headingStyle} onChange={(e) => set({ headingStyle: e.target.value as HeadingStyle })}>
            <option value="standard">Standard</option>
            <option value="narrow">Narrow letters, first word light</option>
          </Select>
        </EditorField>
      </div>

      <div data-field="body">
        <RichTextEditor
          label="Text"
          value={section.bodyHtml}
          onChange={setBody}
          features={LAYOUT_TEXT_FEATURES}
          minHeight={140}
          readOnly={readOnly}
          ariaLabel="Text"
        />
        <FieldError message={errors.body} />
      </div>
      <BrokenLinksNotice links={brokenLinks} />

      <div className="rounded-xl border border-gray-200 p-3" data-field="button">
        <ToggleSwitch
          label="Show a button under the text"
          checked={!!v.button}
          onChange={(on) => set({ button: on ? { label: 'Learn more', href: '' } : null })}
        />
        {v.button && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <EditorField label="Button text" field="buttonLabel" error={errors.buttonLabel} htmlFor={`${k}-blabel`}>
              <TextInput
                id={`${k}-blabel`}
                value={v.button.label}
                maxLength={MAX_BUTTON_LABEL}
                onChange={(e) => setValues((cur) => ({ ...cur, button: cur.button ? { ...cur.button, label: e.target.value } : cur.button }))}
                className={inputError(errors.buttonLabel)}
              />
            </EditorField>
            <div data-field="buttonHref">
              <LinkPicker
                label="Button goes to"
                value={v.button.href}
                initialTarget={v.button.href ? linkTargets[v.button.href] : undefined}
                onChange={(href) => setValues((cur) => ({ ...cur, button: cur.button ? { ...cur.button, href } : cur.button }))}
                hint={v.button.href ? undefined : 'Without a link the button does nothing.'}
              />
              <FieldError message={errors.buttonHref} />
            </div>
          </div>
        )}
      </div>

      <details className="group rounded-xl border border-gray-200">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-sm font-semibold text-gray-700 [&::-webkit-details-marker]:hidden">
          More options
          <span aria-hidden className="text-gray-400 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="border-t border-gray-100 p-3">
          <ToggleSwitch
            label="Space below this section"
            hint="Turn off to make this section sit right on top of the next one."
            checked={!v.disableBottom}
            onChange={(on) => set({ disableBottom: !on })}
          />
        </div>
      </details>
    </div>
  );
}
