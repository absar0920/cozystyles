'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { saveBlogPostAction, deleteBlogPostAction } from '@/app/admin/actions/pages';
import { Field, FormError, Notice, SectionCard, TextInput, ToggleSwitch } from '@/components/admin/ui';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { BrokenLinksNotice } from '@/components/admin/BrokenLinksNotice';
import type { BrokenLink } from '@/lib/link-targets';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { ChipsInput } from '@/components/admin/ChipsInput';
import { slugify } from '@/lib/slug';
import { StickySaveBar } from '@/components/admin/StickySaveBar';
import { UnsavedChangesGuard } from '@/components/admin/UnsavedChangesGuard';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { ConfirmDelete } from '@/components/admin/ConfirmDelete';
import { ArrowLeftIcon } from '@/components/admin/icons';
import { SeoFields } from '../../pages/_components/SeoFields';
import { WebAddressField } from '../../pages/_components/WebAddressField';
import { useEditorSave } from '../../pages/_components/useEditorSave';

export type BlogPostEditorData = {
  id: number;
  title: string;
  /** slug without the `news-` prefix */
  slug: string;
  /** YYYY-MM-DD */
  date: string;
  author: string;
  featuredImage: string | null;
  featuredImageWidth: number | null;
  featuredImageHeight: number | null;
  bodyHtml: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  published: boolean;
};

const FORM_ID = 'blog-post-editor';

/** Create or edit a blog post: separate date, author, featured photo and tags, plus rich text. SPEC §5.3.3. */
export function BlogPostEditor({
  post,
  today,
  created,
  authorSuggestions,
  tagSuggestions,
  deleteConsequences,
  brokenLinks = [],
}: {
  /** null = new post */
  post: BlogPostEditorData | null;
  /** YYYY-MM-DD in the store's time zone (default date of a new post) */
  today: string;
  created?: boolean;
  authorSuggestions: string[];
  tagSuggestions: string[];
  deleteConsequences: string[];
  /** links in the saved text that lead nowhere */
  brokenLinks?: BrokenLink[];
}) {
  const isNew = post == null;
  const { formRef, onSubmit, state, pending, dirty, status, fieldError } = useEditorSave(saveBlogPostAction, 'Blog post');
  // the title input is uncontrolled so text typed before hydration survives; read it once mounted
  useEffect(() => {
    const el = document.getElementById('post-title') as HTMLInputElement | null;
    if (el) setTitle(el.value);
  }, []);
  const [title, setTitle] = useState(post?.title ?? '');
  const [image, setImage] = useState<{ url: string | null; width: number | null; height: number | null }>({
    url: post?.featuredImage ?? null,
    width: post?.featuredImageWidth ?? null,
    height: post?.featuredImageHeight ?? null,
  });
  const [published, setPublished] = useState(post?.published ?? true);
  const [savedPublished, setSavedPublished] = useState(post?.published ?? true);
  const [lastSaved, setLastSaved] = useState<number | undefined>(undefined);
  if (state.ok && state.savedAt && state.savedAt !== lastSaved) {
    setLastSaved(state.savedAt);
    setSavedPublished(published);
  }
  const slug = state.ok && state.slug ? state.slug : (post?.slug ?? '');
  const authorsId = useId();

  const storeHref = !isNew && savedPublished ? `/blogs/news/${slug}` : null;
  const generalError = !state.ok && !state.field ? state.error : null;

  return (
    <div className="pb-28">
      <Link
        href="/admin/blog"
        className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-ink-dark"
      >
        <ArrowLeftIcon className="h-4 w-4" /> All blog posts
      </Link>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-heading text-xl font-bold text-ink-dark">{isNew ? 'New blog post' : post.title}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Blog post</p>
        </div>
        <ViewOnStoreLink href={storeHref} disabledReason={isNew ? 'Save the post to see it on the store' : 'Hidden from the store'} />
      </div>

      <div className="max-w-4xl space-y-6">
        {created && <Notice tone="success">Blog post created.</Notice>}
        {generalError && <Notice tone="error">{generalError}</Notice>}

        <form id={FORM_ID} ref={formRef} onSubmit={onSubmit} className="space-y-6" noValidate>
          {post && <input type="hidden" name="id" value={post.id} />}

          <SectionCard title="Post">
            <div className="space-y-5">
              <Field label="Title" htmlFor="post-title">
                <TextInput
                  id="post-title"
                  name="title"
                  defaultValue={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 5 ways to style a small living room"
                  aria-invalid={!!fieldError('title')}
                />
                <FormError message={fieldError('title')} />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Date" htmlFor="post-date" hint="Shown on the post. Newer posts are listed first.">
                  <TextInput id="post-date" type="date" name="date" defaultValue={post?.date ?? today} required />
                  <FormError message={fieldError('date')} />
                </Field>
                <Field label="Author" htmlFor="post-author" hint="Shown next to the date.">
                  <TextInput id="post-author" name="author" defaultValue={post?.author ?? ''} list={authorsId} maxLength={80} autoComplete="off" />
                  <datalist id={authorsId}>
                    {authorSuggestions.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </Field>
              </div>

              <div>
                <ImageUpload
                  label="Featured photo (optional)"
                  hint="Shown at the top of the post and on the blog page. Recommended 1060 × 550."
                  purpose="blog"
                  previewAspect="1060 / 550"
                  name="featuredImage"
                  value={image.url}
                  onChange={(url, meta) =>
                    setImage(
                      url
                        ? { url, width: meta?.width ?? (url === image.url ? image.width : null), height: meta?.height ?? (url === image.url ? image.height : null) }
                        : { url: null, width: null, height: null },
                    )
                  }
                />
                <input type="hidden" name="featuredImageWidth" value={image.width ?? ''} />
                <input type="hidden" name="featuredImageHeight" value={image.height ?? ''} />
                <FormError message={fieldError('featuredImage')} />
              </div>

              <BrokenLinksNotice links={brokenLinks} />
              <RichTextEditor
                name="content"
                value={post?.bodyHtml ?? ''}
                label="Content"
                hint="Use Heading and Subheading to split the post into parts. You can add photos and YouTube videos."
                placeholder="Write the post here…"
                minHeight={400}
              />

              <ChipsInput
                name="tags"
                value={post?.tags ?? []}
                ariaLabel="Tags"
                label="Tags"
                hint="Each tag gets its own page on the blog."
                placeholder="Type a tag and press Enter"
                suggestions={tagSuggestions}
                // each tag gets a page at /blogs/news/tagged/<slug>, which needs English letters or numbers
                validate={(t) => (/[a-z0-9]/i.test(t.normalize('NFKD')) ? null : `"${t}" can't be used: tags need at least one English letter or number.`)}
                // tags that share a tag page ("Living Room" / "living-room") are the same tag
                sameKey={slugify}
                maxChips={20}
              />
            </div>
          </SectionCard>

          <SeoFields idPrefix="post" seoTitle={post?.seoTitle ?? ''} seoDescription={post?.seoDescription ?? ''} />

          <SectionCard title="Visibility">
            <ToggleSwitch
              name="published"
              label="Visible on the store"
              hint="When off, the post is hidden from the blog and its address shows “page not found”."
              checked={published}
              onChange={setPublished}
            />
          </SectionCard>

          <SectionCard title="Advanced" collapsible defaultOpen={fieldError('handle') != null}>
            <WebAddressField path="/blogs/news/" slug={slug} title={title} isNew={isNew} error={fieldError('handle')} />
          </SectionCard>
        </form>

        {post && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-white px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-dark">Delete this post</p>
              <p className="text-xs text-gray-500">It disappears from the blog and its address shows “page not found”.</p>
            </div>
            <ConfirmDelete
              action={deleteBlogPostAction}
              fields={{ id: String(post.id) }}
              title={`Delete “${post.title}”?`}
              consequences={deleteConsequences}
              triggerLabel="Delete post"
            />
          </div>
        )}
      </div>

      <UnsavedChangesGuard dirty={dirty} />
      <StickySaveBar
        dirty={dirty}
        saving={pending}
        status={status && !savedPublished ? 'Saved as a draft. It is not on the store.' : status}
        error={!state.ok ? state.error : null}
        actions={[{ label: isNew ? 'Create post' : 'Save', type: 'submit', form: FORM_ID }]}
      />
    </div>
  );
}
