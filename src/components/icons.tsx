import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const SearchIcon = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const UserIcon = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1.2-3.4 4-5 7.5-5s6.3 1.6 7.5 5" /></svg>
);
export const HeartIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 20s-7.5-4.6-9.3-9.3C1.4 7.3 3.6 4 7 4c2 0 3.6 1 5 3 1.4-2 3-3 5-3 3.4 0 5.6 3.3 4.3 6.7C19.5 15.4 12 20 12 20z" /></svg>
);
export const MenuIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
export const XIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 5l14 14M19 5L5 19" /></svg>
);
export const ChevronDown = (p: P) => (
  <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>
);
export const ChevronLeft = (p: P) => (
  <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>
);
export const StarIcon = ({ filled = true, half = false, ...p }: P & { filled?: boolean; half?: boolean }) =>
  half ? (
    <svg {...base(p)} strokeWidth={1} fill="none">
      <defs>
        <linearGradient id={`half-${p.id ?? 'x'}`}>
          <stop offset="50%" stopColor="currentColor" />
          <stop offset="50%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.58l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z"
        fill={`url(#half-${p.id ?? 'x'})`}
        stroke="currentColor"
      />
    </svg>
  ) : (
    <svg {...base(p)} strokeWidth={1} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.58L12 17.58l-5.9 3.1 1.13-6.58L2.45 9.44l6.6-.96L12 2.5z" />
    </svg>
  );
export const PhoneIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 3h4l1.5 5L8 9.5a13 13 0 0 0 6.5 6.5L16 13.5l5 1.5v4a2 2 0 0 1-2.2 2A17.5 17.5 0 0 1 3 5.2 2 2 0 0 1 5 3z" /></svg>
);
export const MailIcon = (p: P) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
);
export const MapPinIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
);
export const TruckIcon = (p: P) => (
  <svg {...base(p)}><path d="M1.5 5.5h13v11h-13z" /><path d="M14.5 9.5h4l3 3.5v3.5h-7z" /><circle cx="6" cy="18.5" r="1.8" /><circle cx="17.5" cy="18.5" r="1.8" /></svg>
);
export const ShieldIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 2.5 4.5 5.5v6c0 5 3.2 8.3 7.5 10 4.3-1.7 7.5-5 7.5-10v-6L12 2.5z" /><path d="m8.8 11.8 2.2 2.2 4.2-4.4" /></svg>
);
export const CubeIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 2.5 21 7v10l-9 4.5L3 17V7l9-4.5z" /><path d="M3 7l9 4.5L21 7M12 11.5V21.5" /></svg>
);
export const WhatsappIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...p}>
    <path d="M12.04 2a9.9 9.9 0 0 0-8.4 15.2L2.1 22l4.9-1.5A9.9 9.9 0 1 0 12.04 2zm5.77 14.06c-.24.68-1.4 1.3-1.93 1.35-.5.06-1.13.08-1.81-.11a16.4 16.4 0 0 1-6.57-4.44c-1.85-2.2-2.5-4.2-2.07-5.9.15-.6.53-1.1.87-1.44.34-.34.75-.4 1.03-.4h.53c.28 0 .53.02.75.56.25.6.85 2.06.93 2.2.07.16.12.33.02.53-.1.2-.2.35-.37.53l-.28.31c-.1.1-.2.22-.09.43.12.2.5.87 1.1 1.42.75.68 1.4.9 1.6 1 .2.1.37.07.5-.06.16-.15.6-.65.75-.87.16-.22.32-.18.53-.1.22.07 1.67.78 1.95.93.28.14.47.21.53.33.07.11.07.68-.17 1.35z" />
  </svg>
);
export const FacebookIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M14 8.5V7c0-.8.2-1.2 1.3-1.2H17V3h-2.6C11.6 3 11 4.8 11 6.8v1.7H9v3h2V21h3v-9.5h2.5l.5-3h-3z" /></svg>
);
export const InstagramIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" /></svg>
);
export const YoutubeIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.9C18.2 5 12 5 12 5s-6.2 0-7.8.3A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.9c1.6.3 7.8.3 7.8.3s6.2 0 7.8-.3a2.6 2.6 0 0 0 1.8-1.9A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15.2V8.8L15.5 12 10 15.2z" /></svg>
);
export const LinkedinIcon = (p: P) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M6.5 8.8H3.2V21h3.3V8.8zM4.8 3.5a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zM13 12.3c0-1 .7-1.8 1.9-1.8 1.3 0 1.9.9 1.9 2.3V21H20v-8.6c0-3.2-1.7-4.7-4-4.7-1.9 0-2.7 1-3.2 1.8V8.8H9.6V21H13v-8.7z" /></svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base(p)}><path d="m4.5 12.5 5 5 10-11" /></svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
);
export const MinusIcon = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14" /></svg>
);
export const TrashIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 7h16M9 7V4.5h6V7m-9 0 1 13.5h10L18 7M10 11v6M14 11v6" /></svg>
);
export const EditIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20z" /></svg>
);
export const FilterIcon = (p: P) => (
  <svg {...base(p)}><path d="M4 5h16M7 12h10M10 19h4" /></svg>
);
export const PackageIcon = (p: P) => (
  <svg {...base(p)}><path d="M20 7.5 12 3 4 7.5v9L12 21l8-4.5v-9z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" /></svg>
);

/* ------------------------------------------------------------------
 * Live theme (Habitat) icons — exact markup from interwood.pk.
 * They draw in currentColor and keep their native size unless a className sizes them.
 * ------------------------------------------------------------------ */

/** Header search (19×20, stroke 1.2). */
export const ThemeSearchIcon = (p: P) => (
  <svg width="19" height="20" viewBox="0 0 19 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M13 13.5L17.7495 18.5M15 8C15 11.866 11.866 15 8 15C4.13401 15 1 11.866 1 8C1 4.13401 4.13401 1 8 1C11.866 1 15 4.13401 15 8Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Search-panel close X (14×14, stroke 1.5). */
export const ThemeCloseIcon = (p: P) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M13 1L1 13M13 13L1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Thin right arrow (15×11) — newsletter submit, carousel next. */
export const ThemeArrowRight = (p: P) => (
  <svg width="15" height="11" viewBox="0 0 15 11" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M1 5.5H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.69995 1L14.2 5.5L9.69995 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Thin left arrow (15×11) — carousel prev. */
export const ThemeArrowLeft = (p: P) => (
  <svg width="15" height="11" viewBox="0 0 15 11" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M14 5.5H2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.30002 1L0.800018 5.5L5.30002 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Back-to-top arrow (11×16). The bar is hidden until a parent `.group` is hovered (live hover effect). */
export const ThemeArrowUp = (p: P) => (
  <svg width="11" height="16" viewBox="0 0 11 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path className="origin-top scale-y-0 transition-transform duration-[250ms] ease-theme [transform-box:fill-box] group-hover:scale-y-100" d="M4.87654 2.34497C4.87654 1.99178 5.16285 1.70547 5.51604 1.70547C5.86922 1.70547 6.15554 1.99179 6.15554 2.34497V15.5613C6.15554 15.9144 5.86922 16.2008 5.51604 16.2008C5.16285 16.2008 4.87654 15.9144 4.87654 15.5613V2.34497Z" fill="currentColor" />
    <path d="M0.197525 5.0502L5.02195 0.225769C5.14739 0.100345 5.32293 0.0251028 5.48588 0C5.66143 -7.67342e-09 5.83696 0.0752197 5.96239 0.200647L10.7994 5.03761C10.9373 5.17554 11 5.33858 11 5.51412C11 5.68967 10.9248 5.8652 10.7994 5.99063C10.5486 6.254 10.1223 6.254 9.85892 5.99063L6.16301 2.30726C5.72921 2.1318 5.72921 1.70547 4.83387 2.29472L1.13796 5.99063C0.887198 6.254 0.460891 6.254 0.197525 5.99063C-0.0658415 5.73987 -0.0658415 5.31356 0.197525 5.0502Z" fill="currentColor" />
  </svg>
);

/** Thin angle-down chevron used by the Globo nav (FontAwesome f107 look). */
export const AngleDownIcon = (p: P) => (
  <svg width="9" height="6" viewBox="0 0 9 6" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M1 1.25L4.5 4.75L8 1.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Thin trash icon (cart line remove). */
export const ThemeTrashIcon = (p: P) => (
  <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M1 3.5h11M4.5 3.5V1.75c0-.41.34-.75.75-.75h2.5c.41 0 .75.34.75.75V3.5M2.5 3.5l.7 9.6c.04.5.46.9.97.9h4.66c.5 0 .93-.4.97-.9l.7-9.6M5.25 6.5v4.75M7.75 6.5v4.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
