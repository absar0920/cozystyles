import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getPageByHandle } from '@/lib/queries';
import { Breadcrumbs } from '@/components/catalog/Breadcrumbs';
import { ContactForm } from '@/components/pages/ContactForm';
import { decodeEntities, stripHtml } from '@/components/pages/content';

export const dynamic = 'force-dynamic';

type PageParams = Promise<{ handle: string }>;

export async function generateMetadata({ params }: { params: PageParams }): Promise<Metadata> {
  const { handle } = await params;
  if (handle === 'track-your-order') return { title: 'Track Your Order' };
  const page = await getPageByHandle(handle);
  if (!page) return { title: 'Page not found' };
  const title = decodeEntities(page.seoTitle?.trim() || page.title);
  const description = page.seoDescription?.trim() || stripHtml(page.bodyHtml).slice(0, 160);
  return {
    title,
    ...(description ? { description: description.slice(0, 160) } : {}),
  };
}

export default async function StaticPage({ params }: { params: PageParams }) {
  const { handle } = await params;
  if (handle === 'track-your-order') redirect('/track');

  const page = await getPageByHandle(handle);
  if (!page || !page.published) notFound();

  const title = decodeEntities(page.title);

  return (
    <div className="container-iw py-8 sm:py-10">
      <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: title }]} className="mb-5 sm:mb-7" />

      <header className="mb-7 rounded-2xl bg-cream px-6 py-7 sm:mb-9 sm:px-10 sm:py-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand">Cozy Furnitures</p>
        <h1 className="mt-1.5 text-2xl font-bold text-ink-dark sm:text-3xl lg:text-4xl">{title}</h1>
      </header>

      <div className="rte max-w-4xl" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />

      {handle === 'contact' && (
        <section className="mt-12 max-w-4xl" aria-labelledby="contact-form-heading">
          <div className="rounded-2xl bg-white p-6 shadow-card sm:p-10">
            <h2 id="contact-form-heading" className="text-xl font-bold text-ink-dark sm:text-2xl">
              Send Us a Message
            </h2>
            <p className="mt-1.5 mb-7 text-sm leading-relaxed text-ink-muted">
              Have a question, feedback or a complaint? Fill in the form below and our team will get back to you within
              1–2 business days.
            </p>
            <ContactForm />
          </div>
        </section>
      )}
    </div>
  );
}
