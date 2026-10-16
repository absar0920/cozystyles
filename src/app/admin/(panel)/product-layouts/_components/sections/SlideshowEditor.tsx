'use client';

import { ImageUpload } from '@/components/admin/ImageUpload';
import { SortableList } from '@/components/admin/SortableList';
import type { SlideValues } from '@/lib/product-layout-draft';
import { MAX_SLIDES } from '@/lib/product-layout-sections';
import { AddButton, FieldError, RemoveButton, aspectOf, itemKey, useUndoRemove, type SectionEditorProps } from './common';

/** "Wide photo slideshow" (SPEC §3.5): computer photos with optional separate phone photos. */
export function SlideshowEditor({ section, setValues, errors, imageMeta, addImageMeta }: SectionEditorProps<'slideshow'>) {
  const slides = section.values.slides;
  const setSlides = (next: SlideValues[]) => setValues({ slides: next });
  const patch = (key: string, p: Partial<SlideValues>) => setValues((cur) => ({ slides: cur.slides.map((s) => (s.key === key ? { ...s, ...p } : s)) }));
  const undo = useUndoRemove<SlideValues>((update) => setValues((cur) => ({ slides: update(cur.slides) })));
  const shape = (url: string) => {
    const m = url ? imageMeta[url] : undefined;
    return m ? m.h / m.w : null;
  };
  const first = slides[0];
  const firstDesktop = first ? shape(first.desktop) : null;
  const firstMobile = first ? shape(first.mobile) ?? firstDesktop : null;
  const differs = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) / b > 0.02;

  return (
    <div className="grid gap-3" data-field="slides">
      <p className="text-sm text-gray-600">Put any text inside the photos. With two or more slides they slide by on their own.</p>
      <FieldError message={errors.slides} />
      <SortableList
        items={slides}
        getKey={(s) => s.key}
        onReorder={setSlides}
        ariaLabel="Slides"
        renderItem={(s, ctl) => {
          const cropped = ctl.index > 0 && (differs(shape(s.desktop), firstDesktop) || differs(shape(s.mobile) ?? shape(s.desktop), firstMobile));
          return (
            <div data-testid="slide-item" className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center">
                  {ctl.handle}
                  <span className="text-sm font-semibold text-gray-700">Slide {ctl.index + 1}</span>
                </span>
                <span className="flex items-center">
                  {ctl.arrows}
                  {slides.length > 1 && <RemoveButton label={`Remove slide ${ctl.index + 1}`} onClick={() => undo.remove(s, ctl.index, `Slide ${ctl.index + 1}`)} />}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div data-field={`slides.${s.key}.desktop`}>
                  <ImageUpload
                    label="Computer photo"
                    hint="Shown full width on computers. Recommended about 1920 × 740."
                    value={s.desktop || null}
                    onChange={(url, m) => {
                      if (url && m) addImageMeta(url, m.width, m.height);
                      patch(s.key, { desktop: url ?? '' });
                    }}
                    purpose="layout"
                    previewAspect={aspectOf(imageMeta, s.desktop, '1920 / 740')}
                    previewMaxHeight={340}
                    required
                    allowRemove={false}
                  />
                  <FieldError message={errors[`slides.${s.key}.desktop`]} />
                </div>
                <div data-field={`slides.${s.key}.mobile`}>
                  <ImageUpload
                    label="Phone photo (optional)"
                    hint="A taller photo for phones (about 450 × 700). Without one, phones show the computer photo."
                    value={s.mobile || null}
                    onChange={(url, m) => {
                      if (url && m) addImageMeta(url, m.width, m.height);
                      patch(s.key, { mobile: url ?? '' });
                    }}
                    purpose="layout"
                    previewAspect={aspectOf(imageMeta, s.mobile, '450 / 700')}
                    previewMaxHeight={340}
                  />
                  <FieldError message={errors[`slides.${s.key}.mobile`]} />
                </div>
              </div>
              {cropped && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">Slides are cropped to match the first one.</p>}
            </div>
          );
        }}
      />
      {undo.notice}
      <AddButton
        onClick={() => setSlides([...slides, { key: itemKey('sl'), desktop: '', mobile: '' }])}
        disabled={slides.length >= MAX_SLIDES}
        disabledReason={`A slideshow can have up to ${MAX_SLIDES} slides.`}
      >
        + Add slide
      </AddButton>
    </div>
  );
}
