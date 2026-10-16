import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { resolveLinkTargets } from '@/lib/link-targets';
import { AdminPageHeader } from '@/components/admin/ui';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { BannersManager, type BannerRow } from './_components/BannersManager';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Home banners',
  robots: { index: false, follow: false },
};

/** Home banners (SPEC §5.4): one page with the sortable list and an inline add/edit form. */
export default async function BannersPage() {
  const rows = await prisma.banner.findMany({
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true, title: true, href: true, image: true, mobileImage: true, active: true },
  });
  const banners: BannerRow[] = rows.map((b) => ({ ...b, href: b.href ?? '' }));
  const targets = await resolveLinkTargets([...new Set(banners.map((b) => b.href).filter(Boolean))]);

  return (
    <div className="pb-28">
      <AdminPageHeader
        title="Home banners"
        subtitle="The big photos that slide at the top of the home page"
        actions={<ViewOnStoreLink href="/" />}
      />
      <BannersManager banners={banners} targets={targets} />
    </div>
  );
}
