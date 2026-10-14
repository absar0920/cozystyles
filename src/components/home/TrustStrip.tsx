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

/** Thin trust strip directly below the hero slider. */
export function TrustStrip() {
  return (
    <section aria-label="Why shop with Cozy Furnitures" className="bg-brand-900 text-white">
      <div className="container-iw grid grid-cols-2 gap-x-4 gap-y-4 py-4 lg:grid-cols-4 lg:py-5">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
              <f.icon className="h-5 w-5 text-brand-100" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight sm:text-sm">{f.title}</p>
              <p className="truncate text-tiny text-white/60 sm:text-xs">{f.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
