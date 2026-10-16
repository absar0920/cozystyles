import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getPageByHandle } from '@/lib/queries';
import { AboutPage } from '@/components/pages/AboutPage';
import { BerlinPage } from '@/components/pages/BerlinPage';
import { Catalogues } from '@/components/pages/Catalogues';
import { LandingPage } from '@/components/pages/LandingPage';
import { ContactPage } from '@/components/pages/ContactPage';
import { ComplaintForm, LeadForm, TrackTicket } from '@/components/pages/FormPages';
import { PaymentPopup } from '@/components/pages/PaymentPopup';
import { StoreLocatorPage } from '@/components/pages/StoreLocator';
import { WeddingBuilder } from '@/components/pages/WeddingBuilder';
import { cleanBodyHtml, decodeEntities, markLineStrongs, storedRichText } from '@/components/pages/content';
import { richTextToPlainText } from '@/lib/rich-text/sanitize';
import { getWhatsAppConfig } from '@/lib/whatsapp-server';
import type { WhatsAppConfig } from '@/lib/whatsapp';
import '@/components/pages/content.css';

export const dynamic = 'force-dynamic';

type PageParams = Promise<{ handle: string }>;

/**
 * Page kinds (SPEC §5.3.4): DESIGNED pages whose live markup is a theme/app section are rebuilt as components
 * (their DB body is kept for metadata only); other DESIGNED pages render their legacy body as-is; TEXT pages
 * render sanitised rich text with the live `template-page` styling. Blog posts are not pages (404 here).
 * Live shows no breadcrumb or page title on any of them.
 */
type SectionContext = { whatsapp: WhatsAppConfig | null };

const SECTION_PAGES: Record<string, (ctx: SectionContext) => React.ReactNode> = {
  'about-us': () => <AboutPage />,
  about: () => <AboutPage />,
  contact: () => <ContactPage />,
  'store-locator': () => <StoreLocatorPage />,
  authorized: () => <StoreLocatorPage dealersOnly />,
  catalogues: () => <Catalogues />,
  'lead-form': () => <LeadForm />,
  'loyalty-form': () => null, // the live app block renders nothing
  'support-complaint-form': ({ whatsapp }) => <ComplaintForm whatsapp={whatsapp} />,
  'track-your-ticket': () => <TrackTicket />,
  'wedding-package-builder': () => <WeddingBuilder />,
  // department landing pages (theme sections, data from scripts/fidelity/landing.ts)
  'home-furniture': () => <LandingPage handle="home-furniture" />,
  'office-furniture': () => <LandingPage handle="office-furniture" />,
  berlin: () => <BerlinPage />, // assets: scripts/fidelity/berlin.ts
};

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { handle } = await params;
  const page = await getPageByHandle(handle);
  if (!page || !page.published || page.kind === 'BLOG') return { title: 'Page not found' };
  const title = decodeEntities(page.seoTitle?.trim() || page.title);
  const description = page.seoDescription?.trim() || richTextToPlainText(page.bodyHtml).slice(0, 160);
  return { title, ...(description ? { description: description.slice(0, 160) } : {}) };
}

export default async function StaticPage({ params }: { params: PageParams }) {
  const { handle } = await params;
  const page = await getPageByHandle(handle);
  if (!page || !page.published || page.kind === 'BLOG') notFound();

  const designed = page.kind === 'DESIGNED';
  // opens the WhatsApp chat for order questions (logged by /track)
  if (designed && handle === 'track-your-order') redirect('/track');
  const section = designed ? SECTION_PAGES[handle] : undefined;
  if (section) return <div className="sf-page">{section({ whatsapp: await getWhatsAppConfig() })}</div>;

  return (
    <div className="sf-page sf-tpl-page">
      <div className="section-spacing section-spacing--disable-top">
        {/* flow-root: like live's flex column, the body's trailing margin adds to the section margin */}
        <div className="container-iw flow-root">
          <div
            className={`page-content-width rte ${designed ? '' : 'sf-text-body'}`}
            dangerouslySetInnerHTML={{ __html: designed ? cleanBodyHtml(page.bodyHtml) : markLineStrongs(storedRichText(page.bodyHtml)) }}
          />
        </div>
      </div>
      {handle === 'payment' && <PaymentPopup />}
    </div>
  );
}
