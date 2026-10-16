'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { savePageAction, deletePageAction } from '@/app/admin/actions/pages';
import { Field, FormError, Notice, SectionCard, TextInput, ToggleSwitch } from '@/components/admin/ui';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { BrokenLinksNotice } from '@/components/admin/BrokenLinksNotice';
import type { BrokenLink } from '@/lib/link-targets';
import { StickySaveBar } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { ArrowLeftIcon } from '@/components/admin/icons';
import { SeoFields } from './SeoFields';
import { WebAddressField } from './WebAddressField';
import { useEditorSave } from './useEditorSave';

export type PageEditorData = {
  id: number;
  kind: 'TEXT' | 'DESIGNED';
  title: string;
  handle: string;
  bodyHtml: string;
  seoTitle: string;
  seoDescription: string;
  published: boolean;
};

const FORM_ID = 'page-editor';

/** Edit (or create) a text page, or the search listing and visibility of a custom-design page. SPEC §5.3.2. */
export function PageEditor({
  page,
  created,
  deleteConsequences,
  brokenLinks = [],
}: {
  /** null = new text page */
  page: PageEditorData | null;
  /** first load after creating the page */
  created?: boolean;
  deleteConsequences: string[];
  /** links in the saved text that lead nowhere */
  brokenLinks?: BrokenLink[];
}) {
  const isNew = page == null;
  const designed = page?.kind === 'DESIGNED';
  const { formRef, onSubmit, state, pending, dirty, status, fieldError } = useEditorSave(savePageAction);
  // the title input is uncontrolled so text typed before hydration survives; read it once mounted
  useEffect(() => {
    const el = document.getElementById('page-title') as HTMLInputElement | null;
    if (el) setTitle(el.value);
  }, []);
  const [title, setTitle] = useState(page?.title ?? '');
  const [published, setPublished] = useState(page?.published ?? true);
  const [savedPublished, setSavedPublished] = useState(page?.published ?? true);
  const slug = state.ok && state.slug ? state.slug : (page?.handle ?? '');
  const [lastSaved, setLastSaved] = useState<number | undefined>(undefined);
  if (state.ok && state.savedAt && state.savedAt !== lastSaved) {
    setLastSaved(state.savedAt);
    setSavedPublished(published);
  }

  const storeHref = !isNew && savedPublished ? `/pages/${slug}` : null;
  const generalError = !state.ok && !state.field ? state.error : null;

  return (
    <div className="pb-28">
      <Link
        href="/admin/pages"
        className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-ink-dark"
      >
        <ArrowLeftIcon className="h-4 w-4" /> All pages
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-heading text-xl font-bold text-ink-dark">{isNew ? 'New page' : page.title}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{designed ? 'Custom-design page' : 'Text page'}</p>
        </div>
        <ViewOnStoreLink
          href={storeHref}
          disabledReason={isNew ? 'Save the page to see it on the store' : 'Hidden from the store'}
        />
      </div>

      <div className="max-w-4xl space-y-6">
        {created && (
          <Notice
            tone="info"
            title="Page created"
            action={
              <Link
                href="/admin/menus?tab=about"
                className="inline-flex min-h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Go to Menus
              </Link>
            }
          >
            To let customers find this page, add it to a menu.
          </Notice>
        )}

        {designed && (
          <Notice tone="info" title="This page has a custom design">
            Its layout and text are built into the website, so they can&apos;t be edited here. You can change how it
            appears in search engines and whether it is visible.
            {page.handle === 'track-your-order' && (
              <span className="mt-1 block">This address opens a WhatsApp chat so customers can ask about their order.</span>
            )}
          </Notice>
        )}

        {generalError && <Notice tone="error">{generalError}</Notice>}

        <form id={FORM_ID} ref={formRef} onSubmit={onSubmit} className="space-y-6" noValidate>
          {page && <input type="hidden" name="id" value={page.id} />}

          {designed ? (
            <SectionCard title="Page">
              <Field label="Title" hint="Custom-design pages keep their built-in title.">
                <p className="text-sm font-medium text-ink-dark">{page.title}</p>
              </Field>
            </SectionCard>
          ) : (
            <SectionCard title="Page">
              <div className="space-y-5">
                <Field label="Title" htmlFor="page-title">
                  <TextInput
                    id="page-title"
                    name="title"
                    defaultValue={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Return policy"
                    aria-invalid={!!fieldError('title')}
                  />
                  <FormError message={fieldError('title')} />
                </Field>
                <BrokenLinksNotice links={brokenLinks} />
                <RichTextEditor
                  name="content"
                  value={page?.bodyHtml ?? ''}
                  label="Content"
                  hint="Use Heading and Subheading to split long text into parts."
                  placeholder="Write the page text here…"
                  minHeight={360}
                />
              </div>
            </SectionCard>
          )}

          <SeoFields idPrefix="page" seoTitle={page?.seoTitle ?? ''} seoDescription={page?.seoDescription ?? ''} />

          <SectionCard title="Visibility">
            <ToggleSwitch
              name="published"
              label="Visible on the store"
              hint="When off, customers who open this page see “page not found”."
              checked={published}
              onChange={setPublished}
            />
          </SectionCard>

          {!designed && (
            <SectionCard title="Advanced" collapsible defaultOpen={fieldError('handle') != null}>
              <WebAddressField
                prefix="cozyfurnitures.pk/pages/"
                slug={slug}
                title={title}
                isNew={isNew}
                error={fieldError('handle')}
              />
            </SectionCard>
          )}
        </form>

        {page && !designed && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-white px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-dark">Delete this page</p>
              <p className="text-xs text-gray-500">Customers who open its address will see “page not found”.</p>
            </div>
            <ConfirmDelete
              action={deletePageAction}
              fields={{ id: String(page.id) }}
              title={`Delete “${page.title}”?`}
              consequences={deleteConsequences}
              triggerLabel="Delete page"
            />
          </div>
        )}
      </div>

      <UnsavedChangesGuard dirty={dirty} />
      <StickySaveBar
        dirty={dirty}
        saving={pending}
        status={status}
        error={!state.ok ? state.error : null}
        actions={[{ label: isNew ? 'Create page' : 'Save', type: 'submit', form: FORM_ID }]}
      />
    </div>
  );
}
