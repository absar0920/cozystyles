import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPageByHandle } from '@/lib/queries';
import { ContactPage } from '@/components/pages/ContactPage';
import { decodeEntities } from '@/components/pages/content';
import StaticPage, { generateMetadata as textPageMetadata } from '../[handle]/page';
import '@/components/pages/content.css';
import { canonical } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const HANDLE = 'contact';
const DEFAULT_DESCRIPTION = 'Send us a message, or find our phone number, email address and location.';

/**
 * The built-in Contact us page. Every shop has it, with or without a page called "contact" in Admin → Pages
 * (this static route wins over /pages/[handle]): the contact form (messages land in Admin → Messages) and the
 * phone, email and address from Admin → Settings. It is "Contact us" in the menu link picker.
 *
 * A "contact" row in Admin → Pages still has the last word: hidden → Page not found; a text page the owner wrote
 * → shown like any other text page; the demo's designed Contact page → this page, with its title for the tab.
 */
async function contactRow() {
  const page = await getPageByHandle(HANDLE);
  return page && page.kind !== 'BLOG' ? page : null;
}

const params = () => Promise.resolve({ handle: HANDLE });

export async function generateMetadata(): Promise<Metadata> {
  const page = await contactRow();
  if (page && !page.published) return { title: 'Page not found' };
  if (page?.kind === 'TEXT') return textPageMetadata({ params: params() });
  return {
    title: decodeEntities(page?.seoTitle?.trim() || page?.title?.trim() || 'Contact us'),
    description: (page?.seoDescription?.trim() || DEFAULT_DESCRIPTION).slice(0, 160),
    ...canonical('/pages/contact'),
  };
}

export default async function ContactUsPage() {
  const page = await contactRow();
  if (page && !page.published) notFound();
  if (page?.kind === 'TEXT') return <StaticPage params={params()} />;
  return (
    <div className="sf-page">
      <ContactPage />
    </div>
  );
}
