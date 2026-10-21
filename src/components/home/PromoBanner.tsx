import Link from 'next/link';
import { ChevronRight } from '@/components/icons';

type PromoBannerRow = {
  id: number;
  title: string;
  subtitle: string;
  ctaLabel: string | null;
  href: string | null;
  image: string;
  mobileImage: string | null;
  textColor: string;
  overlay: number;
};

/**
 * Home promo strip (admin locations HOME_STRIP_1 / HOME_STRIP_2). One banner fills the
 * row; several sit side by side. Renders nothing when the location has no active banners.
 */
export function PromoBanner({ banners }: { banners: PromoBannerRow[] }) {
  if (banners.length === 0) return null;
  return (
    <section className="container-iw py-6 lg:py-8" aria-label="Promotions">
      <div className={`grid gap-4 ${banners.length > 1 ? 'sm:grid-cols-2' : ''}`}>
        {banners.map((b) => {
          const dim = Math.min(0.85, Math.max(0, b.overlay / 100));
          const body = (
            <>
              <picture>
                {b.mobileImage && <source media="(max-width: 639px)" srcSet={b.mobileImage} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={b.image}
                  alt={b.title || 'Interwood promotion'}
                  width={1200}
                  height={462}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </picture>
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: `linear-gradient(90deg, rgba(16,58,58,${dim}) 0%, rgba(16,58,58,0) 75%)` }}
              />
              <div className="absolute inset-0 flex items-center p-6 sm:p-10" style={{ color: b.textColor || '#ffffff' }}>
                <div className="max-w-md">
                  {b.title && <h2 className="font-heading text-xl font-bold leading-tight sm:text-3xl">{b.title}</h2>}
                  {b.subtitle && <p className="mt-2 text-sm font-medium opacity-90 sm:text-base">{b.subtitle}</p>}
                  {b.ctaLabel && (
                    <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-white px-5 py-2 text-sm font-semibold text-brand-900">
                      {b.ctaLabel}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </div>
            </>
          );
          const cls = 'group relative block aspect-[450/400] overflow-hidden rounded-xl bg-brand-900 sm:aspect-[1200/400]';
          return b.href ? (
            <Link key={b.id} href={b.href} className={cls}>
              {body}
            </Link>
          ) : (
            <div key={b.id} className={cls}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}
