import Link from 'next/link';
import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { AdminPageHeader } from '@/components/admin/ui';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { ArrangeEditor, type ArrangeCard } from '../_components/ArrangeEditor';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Collections page',
  robots: { index: false, follow: false },
};

/** Order of the cards on the storefront /collections page (SPEC §5.2.2). */
export default async function ArrangeCollectionsPage() {
  const [rows, candidates] = await Promise.all([
    prisma.collectionIndexCard.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      include: { collection: { select: { title: true, image: true } } },
    }),
    prisma.collection.findMany({
      where: { indexCard: null },
      orderBy: { title: 'asc' },
      select: { id: true, title: true, image: true },
    }),
  ]);

  const cards: ArrangeCard[] = rows.map((r) => ({
    key: `c${r.id}`,
    id: r.id,
    collectionId: r.collectionId,
    systemHandle: r.systemHandle,
    title: r.collection?.title ?? r.systemTitle ?? '',
    image: r.collection?.image ?? r.systemImage ?? null,
    placeholder: r.placeholder,
  }));

  return (
    <div className="pb-28">
      <div className="mb-3">
        <Link href="/admin/collections" className="inline-flex min-h-10 items-center text-sm font-semibold text-brand hover:text-brand-600">
          ← Collections
        </Link>
      </div>
      <AdminPageHeader
        title="Collections page"
        subtitle="The cards on the store's Collections page (“Shop by Category”), in this order. Cards with a cover photo also make the home page's “Shop by Category” row (the first 24)."
        actions={<ViewOnStoreLink href="/collections" />}
      />
      <ArrangeEditor initialCards={cards} candidates={candidates} />
    </div>
  );
}
