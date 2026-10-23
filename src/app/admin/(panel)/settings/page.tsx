import type { Metadata } from 'next';
import { getSettingsMap } from '@/lib/queries';
import { resolveLinkTargets } from '@/lib/link-targets';
import { AdminPageHeader } from '@/components/admin/ui';
import { ViewOnStoreLink } from '@/components/admin/ViewOnStoreLink';
import { SettingsForm } from './_components/SettingsForm';
import { SETTINGS_FIELDS, type SettingsValues } from './_lib/fields';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings',
  robots: { index: false, follow: false },
};

/** Store settings (SPEC §5.6): WhatsApp, announcement bar, home page texts, contact details, social links. */
export default async function SettingsPage() {
  const map = await getSettingsMap();
  const initial = Object.fromEntries(SETTINGS_FIELDS.map((k) => [k, map[k] ?? ''])) as SettingsValues;
  const targets = await resolveLinkTargets([initial.announcementHref, initial.announcementCtaHref].filter(Boolean));

  return (
    <div className="pb-28">
      <AdminPageHeader title="Settings" subtitle="WhatsApp ordering, the announcement bar, home page texts, contact details and more" actions={<ViewOnStoreLink href="/" />} />
      <SettingsForm initial={initial} targets={targets} />
    </div>
  );
}
