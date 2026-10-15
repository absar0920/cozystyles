import { AnnouncementBar, Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BackToTop, WhatsappButton } from '@/components/layout/FloatingButtons';
import { CartDrawer } from '@/components/layout/CartDrawer';
import { getMenu, getSettingsMap } from '@/lib/queries';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [menu, information, userArea, seo, settings] = await Promise.all([
    getMenu('MAIN'),
    getMenu('FOOTER_1'),
    getMenu('FOOTER_2'),
    getMenu('FOOTER_SEO'),
    getSettingsMap(),
  ]);

  const announcement = settings.announcement ?? '';

  return (
    <div className="theme-store">
      <AnnouncementBar
        text={announcement}
        href={settings.announcementHref || undefined}
        ctaLabel={settings.announcementCta || undefined}
        ctaHref={settings.announcementCtaHref || undefined}
      />
      <Header menu={menu} hasAnnouncement={announcement !== ''} />
      <main>{children}</main>
      <Footer
        information={information}
        userArea={userArea}
        seo={seo.map((group) => ({ title: group.label, items: group.children }))}
        settings={settings}
      />
      <CartDrawer />
      <BackToTop />
      <WhatsappButton whatsapp={settings.whatsapp ?? ''} />
    </div>
  );
}
