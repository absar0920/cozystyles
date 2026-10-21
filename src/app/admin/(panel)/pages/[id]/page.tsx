import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Page as PageModel } from '@prisma/client';
import { prisma } from '@/lib/db';
import { savePageAction, deletePageAction } from '@/app/admin/actions/content';
import { AdminCard, AdminPageHeader, Field, TextArea, TextInput } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/SubmitButton';
import { ChevronLeft } from '@/components/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit page',
  robots: { index: false, follow: false },
};

const ghostBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50';

/** Public storefront URL — blog posts live under /blogs/news/<slug-after-news->. */
function publicUrl(handle: string, isBlogPost: boolean): string {
  return isBlogPost ? `/blogs/news/${handle.replace(/^news-/, '')}` : `/pages/${handle}`;
}

const fmtDate = (d: Date) => new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function PageEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const saved = sp.saved === '1';
  const missingTitle = sp.error === 'title';
  const isNew = id === 'new';

  let page: PageModel | null = null;
  if (!isNew) {
    const pageId = Number.parseInt(id, 10);
    if (!Number.isFinite(pageId)) notFound();
    page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) notFound();
  }

  return (
    <div>
      <Link href="/admin/pages" className={`${ghostBtn} mb-4`}>
        <ChevronLeft className="h-3.5 w-3.5" /> All pages
      </Link>

      <AdminPageHeader
        title={isNew ? 'New page' : page!.title}
        subtitle={
          isNew
            ? 'Create a storefront page or blog post'
            : `Last updated ${fmtDate(page!.updatedAt)} · created ${fmtDate(page!.createdAt)}`
        }
        actions={
          page && (
            <a
              href={publicUrl(page.handle, page.isBlogPost)}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              View on site →
            </a>
          )
        }
      />

      {saved && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          Page saved. Storefront updated.
        </div>
      )}
      {missingTitle && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          A title is required before saving.
        </div>
      )}

      {page?.published === false && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          This page is a draft — visitors will get a 404 until you publish it.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --------------------------------------------------------------- form */}
        <div className="space-y-6 lg:col-span-2">
          <AdminCard title="Content">
            <form action={savePageAction} className="space-y-4">
              {page && <input type="hidden" name="id" value={page.id} />}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title">
                  <TextInput name="title" defaultValue={page?.title ?? ''} required placeholder="About Interwood" />
                </Field>
                <Field label="Handle" hint="URL slug. Leave empty to generate it from the title.">
                  <TextInput
                    name="handle"
                    defaultValue={page?.handle ?? ''}
                    placeholder={isNew ? 'about-us (auto)' : ''}
                    className="font-mono"
                  />
                </Field>
              </div>

              <Field
                label="Body (HTML)"
                hint="Full HTML content — headings, paragraphs, tables, images and iframes are all supported."
              >
                <TextArea
                  name="bodyHtml"
                  rows={22}
                  defaultValue={page?.bodyHtml ?? ''}
                  placeholder={'<h2>Crafted in Pakistan since 1989</h2>\n<p>Write your page content here…</p>'}
                  className="font-mono text-xs leading-relaxed"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SEO title" hint="Shown in search results and browser tabs.">
                  <TextInput name="seoTitle" defaultValue={page?.seoTitle ?? ''} placeholder="About Interwood — Pakistan’s Largest Furniture Manufacturer" />
                </Field>
                <Field label="SEO description">
                  <TextArea name="seoDescription" rows={3} defaultValue={page?.seoDescription ?? ''} placeholder="A short summary of this page for search engines." />
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-6 border-t border-gray-100 pt-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="published"
                    defaultChecked={page?.published ?? true}
                    className="h-4 w-4 rounded border-gray-300 accent-brand"
                  />
                  Published
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    name="isBlogPost"
                    defaultChecked={page?.isBlogPost ?? false}
                    className="h-4 w-4 rounded border-gray-300 accent-brand"
                  />
                  Blog post
                </label>
                <div className="ml-auto">
                  <SubmitButton>{isNew ? 'Create page' : 'Save page'}</SubmitButton>
                </div>
              </div>
            </form>
          </AdminCard>
        </div>

        {/* -------------------------------------------------------------- side */}
        <div className="space-y-6">
          {page && (
            <AdminCard title="Preview">
              {page.bodyHtml.trim() ? (
                <div className="rte max-h-[28rem] overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/60 p-4 text-sm">
                  {/* Saved version — reload to see pending edits reflected here. */}
                  <div dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
                </div>
              ) : (
                <p className="py-6 text-center text-sm text-gray-400">No content yet.</p>
              )}
            </AdminCard>
          )}

          <AdminCard title="URL">
            <p className="text-xs text-gray-400">This page is served at</p>
            {page ? (
              <a
                href={publicUrl(page.handle, page.isBlogPost)}
                target="_blank"
                rel="noopener"
                className="mt-1 block break-all font-mono text-sm font-semibold text-brand hover:underline"
              >
                {publicUrl(page.handle, page.isBlogPost)}
              </a>
            ) : (
              <p className="mt-1 break-all font-mono text-sm text-gray-500">/pages/&lt;handle&gt;</p>
            )}
            <p className="mt-3 text-xs text-gray-400">
              Handles of blog posts start with <span className="font-mono">news-</span>; the public blog URL drops that
              prefix.
            </p>
          </AdminCard>

          {page && (
            <AdminCard title="Danger zone">
              <p className="text-xs text-gray-500">
                Deleting removes this page permanently. Visitors will get a 404 at its URL.
              </p>
              <details className="relative inline-block w-full text-left">
                <summary className="mt-3 inline-flex w-full cursor-pointer select-none items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 [&::-webkit-details-marker]:hidden">
                  Delete this page
                </summary>
                <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Permanently delete “{page.title}”? This cannot be undone.</p>
                  <form action={deletePageAction} className="mt-2">
                    <input type="hidden" name="id" value={page.id} />
                    <button
                      type="submit"
                      className="w-full rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      Yes, delete permanently
                    </button>
                  </form>
                </div>
              </details>
            </AdminCard>
          )}
        </div>
      </div>
    </div>
  );
}
