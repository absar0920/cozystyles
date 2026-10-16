import { AdminPageHeader, Notice } from '@/components/admin/ui';
import { LayoutList, NewLayoutButton } from './_components/LayoutList';
import { loadLayoutChoices } from './_lib/load';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Product page layouts' };

export default async function ProductLayoutsPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const layouts = await loadLayoutChoices();
  return (
    <div>
      <AdminPageHeader title="Product page layouts" subtitle={`${layouts.length} layout${layouts.length === 1 ? '' : 's'}`} actions={<NewLayoutButton layouts={layouts} />} />
      <div className="mb-4 space-y-3">
        {sp.deleted === '1' && <Notice tone="success">Layout deleted.</Notice>}
        <Notice tone="info">
          These are the sections shown under the description on product pages. Each layout is shared: changing it changes every product that uses it. To give some
          products their own version, make a copy and move those products to it.
        </Notice>
      </div>
      <LayoutList layouts={layouts} />
    </div>
  );
}
