import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getPageByHandle, getSettingsMap } from '@/lib/queries';
import { AboutPage } from '@/components/pages/AboutPage';
import { BerlinPage } from '@/components/pages/BerlinPage';
import { Catalogues } from '@/components/pages/Catalogues';
import { LandingPage } from '@/components/pages/LandingPage';
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
 * render sanitised rich text with the live `template-page` styling, under their title as the page heading (the
 * owner writes the title once, in the Title field). Blog posts are not pages (404 here). No breadcrumb, as on live.
 */
type SectionContext = { whatsapp: WhatsAppConfig | null; settings: Record<string, string> };

const SECTION_PAGES: Record<string, (ctx: SectionContext) => React.ReactNode> = {
  'about-us': () => <AboutPage />,
  about: () => <AboutPage />,
  'store-locator': () => <StoreLocatorPage />,
  authorized: () => <StoreLocatorPage dealersOnly />,
  catalogues: () => <Catalogues />,
  'lead-form': () => <LeadForm />,
  'loyalty-form': () => null, // the live app block renders nothing
  'support-complaint-form': ({ whatsapp, settings }) => (
    <ComplaintForm whatsapp={whatsapp} email={settings.complaintsEmail?.trim() || settings.email?.trim() || ''} />
  ),
  'track-your-ticket': () => <TrackTicket />,
  'wedding-package-builder': () => <WeddingBuilder />,
  // department landing pages (theme sections, data from scripts/fidelity/landing.ts)
  'home-furniture': () => <LandingPage handle="home-furniture" />,
  'office-furniture': () => <LandingPage handle="office-furniture" />,
  berlin: () => <BerlinPage />, // assets: scripts/fidelity/berlin.ts
};

const plain = (html: string) =>
  decodeEntities(html.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .replace(/[\s.:]+$/, '')
    .trim()
    .toLowerCase();

/** A text body that opens with its own copy of the title (a heading or a bold line): drop it, the page shows the title. */
function withoutRepeatedTitle(html: string, title: string): string {
  const first = /^\s*<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(html);
  if (!first) return html;
  const boldLine = /^\s*<strong\b[^>]*>[\s\S]*<\/strong>\s*$/i.test(first[2]);
  if (first[1].toLowerCase() === 'p' && !boldLine) return html;
  return plain(first[2]) === plain(title) ? html.slice(first[0].length) : html;
}

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
  if (section) {
    const [whatsapp, settings] = await Promise.all([getWhatsAppConfig(), getSettingsMap()]);
    return <div className="sf-page">{section({ whatsapp, settings })}</div>;
  }

  const title = decodeEntities(page.title).trim();
  const bodyHtml = designed
    ? cleanBodyHtml(page.bodyHtml)
    : markLineStrongs(withoutRepeatedTitle(storedRichText(page.bodyHtml), title));

  return (
    <div className="sf-page sf-tpl-page">
      <div className="section-spacing section-spacing--disable-top">
        {/* flow-root: like live's flex column, the body's trailing margin adds to the section margin */}
        <div className="container-iw flow-root">
          {!designed && title && <h1 className="h2 m-0 break-words pt-10">{title}</h1>}
          <div
            className={`page-content-width rte ${designed ? '' : 'sf-text-body'}`}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        </div>
      </div>
      {handle === 'payment' && <PaymentPopup />}
    </div>
  );
}
