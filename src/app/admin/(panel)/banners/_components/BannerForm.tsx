'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { saveBannerAction, type BannerFormState } from '@/app/admin/actions/banners';
import type { LinkTarget } from '@/lib/links';
import { Field, FormError, TextInput, ToggleSwitch } from '@/components/admin/ui';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { LinkPicker } from '@/components/admin/LinkPicker';
import { StickySaveBar } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import type { BannerRow } from './BannersManager';

type Values = { title: string; image: string; mobileImage: string; href: string; active: boolean };

const INITIAL_STATE: BannerFormState = { ok: false };

/** Inline add/edit form for one banner. Owns the page's only save bar while it is open. */
export function BannerForm({
  banner,
  target,
  onSaved,
  onCancel,
}: {
  banner: BannerRow | null;
  target?: LinkTarget;
  /** `guarded`: the form had unsaved changes when saved, so its UnsavedChangesGuard steps back in history after the save */
  onSaved: (id: number, guarded: boolean) => void;
  onCancel: () => void;
}) {
  const initial: Values = {
    title: banner?.title ?? '',
    image: banner?.image ?? '',
    mobileImage: banner?.mobileImage ?? '',
    href: banner?.href ?? '',
    active: banner?.active ?? true,
  };
  const [values, setValues] = useState<Values>(initial);
  const [baseline] = useState<Values>(initial);
  const [state, formAction, pending] = useActionState(saveBannerAction, INITIAL_STATE);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const formId = useId();
  const handled = useRef<number | undefined>(undefined);
  const submittedDirty = useRef(false);

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const set = <K extends keyof Values>(key: K, v: Values[K]) => setValues((prev) => ({ ...prev, [key]: v }));

  useEffect(() => {
    if (state.ok && state.savedAt && state.savedAt !== handled.current && state.savedId) {
      handled.current = state.savedAt;
      onSaved(state.savedId, submittedDirty.current);
    }
  }, [state, onSaved]);

  useEffect(() => {
    formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const fe = state.ok ? {} : state.fieldErrors ?? {};
  const cancel = () => (dirty ? setConfirmDiscard(true) : onCancel());

  return (
    <form
      ref={formRef}
      id={formId}
      data-testid="banner-form"
      onSubmit={(e) => {
        e.preventDefault();
        submittedDirty.current = dirty;
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-5 rounded-xl border-2 border-brand-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <h2 className="font-heading text-base font-bold text-ink-dark">{banner ? 'Edit banner' : 'New banner'}</h2>
      {banner && <input type="hidden" name="id" value={banner.id} />}

      <div className="grid gap-5 md:grid-cols-[3fr_2fr]">
        <div>
          <ImageUpload
            name="image"
            value={values.image || null}
            onChange={(url) => set('image', url ?? '')}
            label="Computer photo"
            hint="Recommended 1200 × 462. Put your text inside the photo."
            purpose="banner"
            previewAspect="1200 / 462"
            required
          />
          <FormError message={fe.image} />
        </div>
        <div className="max-w-[200px]">
          <ImageUpload
            name="mobileImage"
            value={values.mobileImage || null}
            onChange={(url) => set('mobileImage', url ?? '')}
            label="Phone photo (optional)"
            hint="Recommended 450 × 700. If empty, phones show the computer photo."
            purpose="banner"
            previewAspect="450 / 700"
          />
          <FormError message={fe.mobileImage} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <LinkPicker
            name="href"
            value={values.href}
            onChange={(href) => set('href', href)}
            initialTarget={target}
            label="Link"
            hint="Where a tap on the slide goes. Choose “No link” if the slide is just a picture."
          />
          <FormError message={fe.href} />
        </div>
        <div>
          <Field label="Name (only for you and screen readers)" htmlFor={`${formId}-title`} hint="Optional. Describe the photo, e.g. “Wedding season sale”.">
            <TextInput
              id={`${formId}-title`}
              name="title"
              value={values.title}
              maxLength={120}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Wedding season sale"
            />
          </Field>
          <FormError message={fe.title} />
        </div>
      </div>

      <ToggleSwitch
        name="active"
        label="Show on the store"
        hint="Turn off to hide this slide without deleting it."
        checked={values.active}
        onChange={(v) => set('active', v)}
      />

      <UnsavedChangesGuard dirty={dirty && !pending} />
      <StickySaveBar
        dirty={dirty}
        saving={pending}
        error={!state.ok ? state.error : null}
        status={banner ? 'Editing banner' : 'New banner'}
        actions={[
          { label: 'Cancel', variant: 'secondary', type: 'button', onClick: cancel },
          { label: banner ? 'Save banner' : 'Add banner', shortLabel: 'Save', type: 'submit', form: formId },
        ]}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard your changes?"
        consequences={['The changes you made to this banner are not saved.']}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => {
          setConfirmDiscard(false);
          onCancel();
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </form>
  );
}
