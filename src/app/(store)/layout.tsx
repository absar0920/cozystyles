import { Header } from '@/components/layout/Header';
import { Footer, WhatsappButton } from '@/components/layout/Footer';
import { getMenu, getSettingsMap } from '@/lib/queries';
import type { MenuNode } from '@/lib/queries';

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [menu, foot1, foot2, foot3, topbar, settings] = await Promise.all([
    getMenu('MAIN'),
    getMenu('FOOTER_1'),
    getMenu('FOOTER_2'),
    getMenu('FOOTER_3'),
    getMenu('TOPBAR'),
    getSettingsMap(),
  ]);

  const columns = [
    { title: 'About', items: foot1 },
    { title: 'Customer Support', items: foot2 },
    { title: 'Shop', items: foot3 },
  ];

  return (
    <>
      <Header menu={menu} announcement={topbar[0]?.label ?? settings.announcement ?? ''} phone={settings.phone ?? ''} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer columns={columns} settings={settings} />
      <WhatsappButton whatsapp={settings.whatsapp ?? ''} />
    </>
  );
}
