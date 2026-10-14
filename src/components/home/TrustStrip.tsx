import { TruckIcon, CubeIcon, StarIcon, PackageIcon } from '@/components/icons';

const FEATURES = [
  {
    icon: TruckIcon,
    title: 'Free Delivery & Installation',
    subtitle: 'Nationwide, across Pakistan',
  },
  {
    icon: CubeIcon,
    title: 'View in AR',
    subtitle: 'Preview furniture in your space',
  },
  {
    icon: StarIcon,
    title: 'Rewards Program',
    subtitle: 'Earn points on every order',
  },
  {
    icon: PackageIcon,
    title: 'Corporate & B2B',
    subtitle: 'Bulk & project solutions',
  },
];

/** Card-free trust row on white: brand-50 icon discs split by hairline rules. */
export function TrustStrip() {
  return (
    <section aria-label="Why shop with Cozy Furnitures" className="bg-white">
      <div className="container-iw grid grid-cols-2 gap-y-4 py-5 lg:grid-cols-4 lg:py-6">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className={`flex items-center gap-3 border-cream-border lg:border-l lg:pl-6 lg:first:border-l-0 lg:first:pl-0 ${
              i % 2 === 1 ? 'border-l pl-4' : ''
            }`}
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50">
              <f.icon className="h-5 w-5 text-brand-600" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight text-ink-dark sm:text-sm">{f.title}</p>
              <p className="truncate text-tiny text-ink-muted sm:text-xs">{f.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
