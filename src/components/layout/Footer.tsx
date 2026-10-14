import { Logo } from '@/components/brand/Logo';
import Link from 'next/link';
import type { MenuNode } from '@/lib/queries';
import {
  PhoneIcon,
  MailIcon,
  MapPinIcon,
  FacebookIcon,
  InstagramIcon,
  YoutubeIcon,
  LinkedinIcon,
  WhatsappIcon,
  TruckIcon,
  StarIcon,
  ShieldIcon,
  CheckIcon,
} from '@/components/icons';
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
    <footer className="mt-16 bg-cream text-ink">
      {/* features strip — white borderless cards above the footer body */}
      <div className="container-iw pt-10 sm:pt-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FooterFeature
            icon={TruckIcon}
            title="Free Nationwide Delivery"
            desc="Free delivery & installation across Pakistan"
          />
          <FooterFeature icon={StarIcon} title="Since 1974" desc="Pakistan’s largest furniture manufacturer" />
          <FooterFeature icon={ShieldIcon} title="Lifelong Service" desc="Dedicated after-sales support" />
        </div>
      </div>

      <div className="container-iw grid grid-cols-2 gap-8 border-t border-cream-border py-12 md:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2">
          <Logo size="lg" withTagline className="mb-4" />
          <p className="mb-5 max-w-sm text-[13px] leading-relaxed text-ink-muted">
            {settings.legalBlurb ?? 'Cozy Furnitures offers an exciting and affordable range of bedroom, living and office furniture, kitchens, doors, wardrobes, flooring and home décor — to suit every style & space.'}
          </p>
          <ul className="space-y-2.5 text-[13px] text-ink">
            <li className="flex items-start gap-2.5">
              <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <a href={`tel:${(settings.phone ?? '').replace(/-/g, '')}`} className="transition hover:text-brand">
                {settings.phone}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <a href={`mailto:${settings.email}`} className="transition hover:text-brand">
                {settings.email}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>{settings.address}</span>
            </li>
          </ul>
          <div className="mt-5 flex gap-2.5">
            {socials.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white shadow-sm transition hover:bg-brand-600 hover:shadow-md"
              >
                <Icon className="h-4.5 w-4.5" />
              </a>
            ))}
          </div>
          <NewsletterForm />
          <div className="mt-6">
            <div className="flex flex-wrap gap-2">
              {['Quality You Can Trust', '1-Year Warranty', 'Lifelong Service'].map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-ink shadow-sm"
                >
                  <CheckIcon className="h-3.5 w-3.5 text-brand" aria-hidden />
                  {c}
                </span>
              ))}
            </div>
          </div>
        </div>

        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-ink-dark">{col.title}</h3>
            <ul className="space-y-2.5">
              {col.items.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="text-[13px] text-ink-muted transition hover:text-brand">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="bg-brand-900">
        <div className="container-iw flex flex-col items-center gap-4 py-5 text-[12px] text-white/60 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Cozy Furnitures (Pvt.) Ltd. All rights reserved.</p>
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
              Installment Plans &amp; Payment Gateway
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {['VISA', 'Mastercard', 'Amex', 'Bank Transfer', 'COD', 'Baadmay'].map((m) => (
                <span key={m} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70">
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterFeature({
  icon: Icon,
  title,
  desc,
}: {
  icon: (p: React.SVGProps<SVGSVGElement>) => React.ReactElement;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-card">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="font-heading text-sm font-bold text-ink-dark">{title}</h3>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">{desc}</p>
      </div>
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
