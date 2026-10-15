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
import { cleanBodyHtml, decodeEntities, stripHtml } from '@/components/pages/content';
import '@/components/pages/content.css';

export const dynamic = 'force-dynamic';

type PageParams = Promise<{ handle: string }>;

/**
 * Pages whose live markup is a theme/app section rather than rich text are rebuilt as components
 * (their DB body is kept for metadata only). Everything else renders the DB body with the live
 * `template-page` rich-text styling. Live shows no breadcrumb or page title on any of them.
 */
const SECTION_PAGES: Record<string, () => React.ReactNode> = {
  'about-us': () => <AboutPage />,
  about: () => <AboutPage />,
  contact: () => <ContactPage />,
  'store-locator': () => <StoreLocatorPage />,
  authorized: () => <StoreLocatorPage dealersOnly />,
  catalogues: () => <Catalogues />,
  'lead-form': () => <LeadForm />,
  'loyalty-form': () => null, // the live app block renders nothing
  'support-complaint-form': () => <ComplaintForm />,
  'track-your-ticket': () => <TrackTicket />,
  'wedding-package-builder': () => <WeddingBuilder />,
  // department landing pages (theme sections, data from scripts/fidelity/landing.ts)
  'home-furniture': () => <LandingPage handle="home-furniture" />,
  'office-furniture': () => <LandingPage handle="office-furniture" />,
  berlin: () => <BerlinPage />, // assets: scripts/fidelity/berlin.ts
};

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { handle } = await params;
  if (handle === 'track-your-order') return { title: 'Track Your Order' };
  const page = await getPageByHandle(handle);
  if (!page || !page.published) return { title: 'Page not found' };
  const title = decodeEntities(page.seoTitle?.trim() || page.title);
  const description = page.seoDescription?.trim() || stripHtml(page.bodyHtml).slice(0, 160);
  return { title, ...(description ? { description: description.slice(0, 160) } : {}) };
}

export default async function StaticPage({ params }: { params: PageParams }) {
  const { handle } = await params;
  if (handle === 'track-your-order') redirect('/track');

  const page = await getPageByHandle(handle);
  if (!page || !page.published) notFound();

  const section = SECTION_PAGES[handle];
  if (section) return <div className="sf-page">{section()}</div>;

  return (
    <div className="sf-page sf-tpl-page">
      <div className="section-spacing section-spacing--disable-top">
        {/* flow-root: like live's flex column, the body's trailing margin adds to the section margin */}
        <div className="container-iw flow-root">
          <div className="page-content-width rte" dangerouslySetInnerHTML={{ __html: cleanBodyHtml(page.bodyHtml) }} />
        </div>
      </div>
      {handle === 'payment' && <PaymentPopup />}
    </div>
  );
}
