import { Logo } from '@/components/brand/Logo';
import Link from 'next/link';
import Image from 'next/image';
import type { MenuNode } from '@/lib/queries';
import { PhoneIcon, MailIcon, MapPinIcon, FacebookIcon, InstagramIcon, YoutubeIcon, LinkedinIcon, WhatsappIcon } from '@/components/icons';
import { NewsletterForm } from '@/components/layout/NewsletterForm';

type FooterProps = {
  columns: { title: string; items: MenuNode[] }[];
  settings: Record<string, string>;
};

export function Footer({ columns, settings }: FooterProps) {
  const socials = [
    { href: settings.facebook ?? '#', label: 'Facebook', Icon: FacebookIcon },
    { href: settings.instagram ?? '#', label: 'Instagram', Icon: InstagramIcon },
    { href: settings.youtube ?? '#', label: 'YouTube', Icon: YoutubeIcon },
    { href: settings.linkedin ?? '#', label: 'LinkedIn', Icon: LinkedinIcon },
  ].filter((s) => s.href && s.href !== '#');

  return (
    <footer className="mt-16 bg-brand-900 text-white">
      {/* top strip */}
      <div className="border-b border-white/10">
        <div className="container-iw grid grid-cols-1 gap-6 py-8 sm:grid-cols-3">
          <FooterFeature title="Free Nationwide Delivery" desc="Free delivery & installation across Pakistan" />
          <FooterFeature title="Since 1974" desc="Pakistan’s largest furniture manufacturer" />
          <FooterFeature title="Lifelong Service" desc="Dedicated after-sales support" />
        </div>
      </div>

      <div className="container-iw grid grid-cols-2 gap-8 py-12 md:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2">
          <Logo variant="light" size="lg" withTagline className="mb-4" />
          <p className="mb-5 max-w-sm text-[13px] leading-relaxed text-white/70">
            {settings.legalBlurb ?? 'Cozy Furnitures offers an exciting and affordable range of bedroom, living and office furniture, kitchens, doors, wardrobes, flooring and home décor — to suit every style & space.'}
          </p>
          <ul className="space-y-2.5 text-[13px] text-white/80">
            <li className="flex items-start gap-2.5">
              <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
              <a href={`tel:${(settings.phone ?? '').replace(/-/g, '')}`} className="hover:text-white">{settings.phone}</a>
            </li>
            <li className="flex items-start gap-2.5">
              <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
              <a href={`mailto:${settings.email}`} className="hover:text-white">{settings.email}</a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-300" />
              <span>{settings.address}</span>
            </li>
          </ul>
          <div className="mt-5 flex gap-2.5">
            {socials.map(({ href, label, Icon }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition hover:bg-brand">
                <Icon className="h-4.5 w-4.5" />
              </a>
            ))}
          </div>
          <NewsletterForm />
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/60">Certified by</p>
            <div className="flex flex-wrap gap-2">
              {['FSC', 'IAS', 'EIAC', 'BMTF'].map((c) => (
                <span key={c} className="rounded border border-white/20 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/75">{c}</span>
              ))}
            </div>
          </div>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-white">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="text-[13px] text-white/70 transition hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-white/10">
        <div className="container-iw flex flex-col items-center gap-4 py-5 text-[12px] text-white/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Cozy Furnitures (Pvt.) Ltd. All rights reserved.</p>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              Installment Plans &amp; Payment Gateway
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {['VISA', 'Mastercard', 'Amex', 'Bank Transfer', 'COD', 'Baadmay'].map((m) => (
                <span key={m} className="rounded border border-white/20 px-2 py-1 text-[10px] font-semibold text-white/70">{m}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterFeature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="text-center sm:text-left">
      <h3 className="font-heading text-sm font-bold">{title}</h3>
      <p className="mt-1 text-[12.5px] text-white/60">{desc}</p>
    </div>
  );
}

export function WhatsappButton({ whatsapp }: { whatsapp: string }) {
  if (!whatsapp) return null;
  return (
    <a
      href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}`}
      target="_blank"
      rel="noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-hover transition hover:scale-105"
    >
      <WhatsappIcon className="h-7 w-7" />
    </a>
  );
}
