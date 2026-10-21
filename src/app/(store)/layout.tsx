import { AnnouncementBar, Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BackToTop, WhatsappButton } from '@/components/layout/FloatingButtons';
import { getMenu, getSettingsMap } from '@/lib/queries';
import { getWhatsAppConfig } from '@/lib/whatsapp-server';

// Menus and settings are edited in the admin, so every storefront page renders per request. This also keeps
// `next build` from reading the database (Hostinger builds before the app can reach it).
export const dynamic = 'force-dynamic';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [menu, information, userArea, seo, settings, whatsapp] = await Promise.all([
    getMenu('MAIN'),
    getMenu('FOOTER_1'),
    getMenu('FOOTER_2'),
    getMenu('FOOTER_SEO'),
    getSettingsMap(),
    getWhatsAppConfig(),
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
      <BackToTop />
      <WhatsappButton config={whatsapp} />
    </div>
  );
}
