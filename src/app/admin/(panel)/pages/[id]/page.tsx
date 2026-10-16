import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { findBrokenLinks } from '@/lib/link-targets';
import { storedRichText } from '@/components/pages/content';
import { PageEditor, type PageEditorData } from '../_components/PageEditor';
import { deleteConsequences } from '../_lib/consequences';

import { decodeEntities } from '@/components/pages/content';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Edit page',
  robots: { index: false, follow: false },
};

/** /admin/pages/new creates a text page; /admin/pages/<id> edits a text or custom-design page. */
export default async function PageEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);

  if (id === 'new') return <PageEditor key="new" page={null} deleteConsequences={[]} />;

  const pageId = Number(id);
  if (!Number.isInteger(pageId) || pageId <= 0) notFound();
  const page = await prisma.page.findUnique({ where: { id: pageId } });
  if (!page) notFound();
  if (page.kind === 'BLOG') redirect(`/admin/blog/${page.id}`);

  const data: PageEditorData = {
    id: page.id,
    kind: page.kind === 'DESIGNED' ? 'DESIGNED' : 'TEXT',
    title: decodeEntities(page.title),
    handle: page.handle,
    // custom-design bodies are legacy markup the admin never edits
    bodyHtml: page.kind === 'DESIGNED' ? '' : storedRichText(page.bodyHtml),
    seoTitle: page.seoTitle ?? '',
    seoDescription: page.seoDescription ?? '',
    published: page.published,
  };

  return (
    <PageEditor
      key={page.id}
      page={data}
      created={sp.created === '1'}
      deleteConsequences={data.kind === 'TEXT' ? await deleteConsequences(page) : []}
      brokenLinks={data.kind === 'TEXT' ? await findBrokenLinks(data.bodyHtml) : []}
    />
  );
}
