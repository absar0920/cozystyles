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
export const CartIcon = (p: P) => (
  <svg {...base(p)}><path d="M2.5 3h2l2.2 12.4a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.2L20.5 7H6" /><circle cx="9.5" cy="20.5" r="1.4" /><circle cx="17.5" cy="20.5" r="1.4" /></svg>
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

/** Header account (19×21). */
export const ThemeAccountIcon = (p: P) => (
  <svg width="19" height="21" viewBox="0 0 19 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M9.3486 1C15.5436 1 15.5436 10.4387 9.3486 10.4387C3.15362 10.4387 3.15362 1 9.3486 1ZM1 19.9202C1.6647 9.36485 17.4579 9.31167 18.0694 19.9468L17.0857 20C16.5539 10.6145 2.56869 10.6411 2.01034 19.9734L1.02659 19.9202H1ZM9.3486 2.01034C4.45643 2.01034 4.45643 9.42836 9.3486 9.42836C14.2408 9.42836 14.2408 2.01034 9.3486 2.01034Z" fill="currentColor" stroke="currentColor" strokeWidth="0.1" />
  </svg>
);

/** Header cart (23×22). */
export const ThemeCartIcon = (p: P) => (
  <svg width="23" height="22" viewBox="0 0 23 22" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M4.42858 4.45C4.12482 4.45 3.87858 4.69624 3.87858 5C3.87858 5.30376 4.12482 5.55 4.42858 5.55V4.45ZM22.3714 5L22.9003 5.1511C22.9477 4.98515 22.9145 4.80658 22.8105 4.66879C22.7066 4.53101 22.544 4.45 22.3714 4.45V5ZM19.7316 14.2396L20.2604 14.3907L19.7316 14.2396ZM18.1931 15.4V15.95V15.4ZM8.60688 15.4V15.95V15.4ZM7.06844 14.2396L6.53961 14.3907L7.06844 14.2396ZM3.45149 1.58022L3.98033 1.42913V1.42913L3.45149 1.58022ZM2.68227 1L2.68227 0.45H2.68227V1ZM1 0.45C0.696243 0.45 0.45 0.696243 0.45 1C0.45 1.30376 0.696243 1.55 1 1.55V0.45ZM9.25 19.4C9.25 19.9799 8.7799 20.45 8.2 20.45V21.55C9.38741 21.55 10.35 20.5874 10.35 19.4H9.25ZM8.2 20.45C7.6201 20.45 7.15 19.9799 7.15 19.4H6.05C6.05 20.5874 7.01259 21.55 8.2 21.55V20.45ZM7.15 19.4C7.15 18.8201 7.6201 18.35 8.2 18.35V17.25C7.01259 17.25 6.05 18.2126 6.05 19.4H7.15ZM8.2 18.35C8.7799 18.35 9.25 18.8201 9.25 19.4H10.35C10.35 18.2126 9.38741 17.25 8.2 17.25V18.35ZM19.65 19.4C19.65 19.9799 19.1799 20.45 18.6 20.45V21.55C19.7874 21.55 20.75 20.5874 20.75 19.4H19.65ZM18.6 20.45C18.0201 20.45 17.55 19.9799 17.55 19.4H16.45C16.45 20.5874 17.4126 21.55 18.6 21.55V20.45ZM17.55 19.4C17.55 18.8201 18.0201 18.35 18.6 18.35V17.25C17.4126 17.25 16.45 18.2126 16.45 19.4H17.55ZM18.6 18.35C19.1799 18.35 19.65 18.8201 19.65 19.4H20.75C20.75 18.2126 19.7874 17.25 18.6 17.25V18.35ZM4.42858 5.55H22.3714V4.45H4.42858V5.55ZM21.8426 4.8489L19.2027 14.0885L20.2604 14.3907L22.9003 5.1511L21.8426 4.8489ZM19.2027 14.0885C19.14 14.3079 19.0076 14.5009 18.8254 14.6383L19.4878 15.5164C19.8608 15.2351 20.132 14.8399 20.2604 14.3907L19.2027 14.0885ZM18.8254 14.6383C18.6433 14.7757 18.4213 14.85 18.1931 14.85V15.95C18.6603 15.95 19.1148 15.7978 19.4878 15.5164L18.8254 14.6383ZM18.1931 14.85H8.60688V15.95H18.1931V14.85ZM8.60688 14.85C8.37871 14.85 8.15674 14.7757 7.97458 14.6383L7.31216 15.5164C7.68516 15.7978 8.13967 15.95 8.60688 15.95V14.85ZM7.97458 14.6383C7.79241 14.5009 7.65997 14.3079 7.59728 14.0885L6.53961 14.3907C6.66796 14.8399 6.93916 15.2351 7.31216 15.5164L7.97458 14.6383ZM7.59728 14.0885L3.98033 1.42913L2.92265 1.73132L6.53961 14.3907L7.59728 14.0885ZM3.98033 1.42913C3.89974 1.14705 3.72945 0.898895 3.49524 0.72223L2.83282 1.60041C2.87619 1.63313 2.90773 1.67908 2.92265 1.73132L3.98033 1.42913ZM3.49524 0.72223C3.26103 0.545564 2.97564 0.45 2.68227 0.45L2.68227 1.55C2.7366 1.55 2.78945 1.5677 2.83282 1.60041L3.49524 0.72223ZM2.68227 0.45H1V1.55H2.68227V0.45Z" fill="currentColor" />
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

/** Empty-cart illustration (82×82). */
export const EmptyCartIcon = (p: P) => (
  <svg width="82" height="82" viewBox="0 0 82 82" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M63.2133 82.0001C58.4983 82.0001 54.6765 78.1637 54.6765 73.4633C54.6765 68.7483 58.5129 64.9265 63.2133 64.9265C67.9137 64.9265 71.7501 68.7629 71.7501 73.4633C71.7501 78.1637 67.9137 82.0001 63.2133 82.0001ZM63.2133 68.3383C60.3872 68.3383 58.0883 70.6372 58.0883 73.4633C58.0883 76.2894 60.3872 78.5883 63.2133 78.5883C66.0394 78.5883 68.3383 76.2894 68.3383 73.4633C68.3383 70.6372 66.0394 68.3383 63.2133 68.3383Z" fill="currentColor" />
    <path d="M29.0368 82.0001C24.3218 82.0001 20.5 78.1637 20.5 73.4633C20.5 68.7483 24.3364 64.9265 29.0368 64.9265C33.7372 64.9265 37.5736 68.7629 37.5736 73.4633C37.5882 78.1637 33.7518 82.0001 29.0368 82.0001ZM29.0368 68.3383C26.2107 68.3383 23.9118 70.6372 23.9118 73.4633C23.9118 76.2894 26.2107 78.5883 29.0368 78.5883C31.8629 78.5883 34.1618 76.2894 34.1618 73.4633C34.1618 70.6372 31.8629 68.3383 29.0368 68.3383Z" fill="currentColor" />
    <path d="M70.0368 61.4999H30.6036C24.9221 61.4999 20.0021 57.4585 18.8746 51.8942L10.5575 10.2499H1.71321C0.761429 10.2499 0 9.48849 0 8.5367C0 7.59956 0.761429 6.82349 1.71321 6.82349H11.9632C12.7832 6.82349 13.4714 7.39456 13.6325 8.19991L22.2425 51.206C23.0332 55.1888 26.5621 58.0735 30.6182 58.0735H70.0514C70.9886 58.0735 71.7646 58.8349 71.7646 59.7867C71.75 60.7385 70.9886 61.4999 70.0368 61.4999Z" fill="currentColor" />
    <path d="M67.4304 47.8383H20.5001C19.5629 47.8383 18.7869 47.0768 18.7869 46.125C18.7869 45.1733 19.5483 44.4118 20.5001 44.4118H67.4304C70.0076 44.4118 72.204 42.479 72.5115 39.9165C72.6286 38.9793 73.5365 38.3204 74.4151 38.4376C75.3522 38.5547 76.0111 39.404 75.894 40.3411C75.3668 44.6168 71.7208 47.8383 67.4304 47.8383Z" fill="currentColor" />
    <path d="M39.2869 20.4999H15.3751C14.4379 20.4999 13.6619 19.7385 13.6619 18.7867C13.6619 17.8496 14.4233 17.0735 15.3751 17.0735H39.2869C40.224 17.0735 41.0001 17.8349 41.0001 18.7867C41.0001 19.7385 40.2386 20.4999 39.2869 20.4999Z" fill="currentColor" />
    <path d="M63.2133 37.5882C52.8608 37.5882 44.4265 29.1539 44.4265 18.8014C44.4265 8.44893 52.8462 0 63.2133 0C73.5658 0 82.0001 8.43429 82.0001 18.7868C82.0001 29.1393 73.5658 37.5882 63.2133 37.5882ZM63.2133 3.41179C54.7351 3.41179 47.8383 10.3086 47.8383 18.7868C47.8383 27.265 54.7351 34.1618 63.2133 34.1618C71.6915 34.1618 78.5883 27.265 78.5883 18.7868C78.5883 10.3086 71.6915 3.41179 63.2133 3.41179Z" fill="currentColor" />
    <path d="M70.0368 27.3382C69.5976 27.3382 69.1583 27.1771 68.8215 26.8404L55.1597 13.1786C54.4861 12.505 54.4861 11.4361 55.1597 10.7625C55.8333 10.0889 56.9022 10.0889 57.5758 10.7625L71.2376 24.4243C71.9111 25.0979 71.9111 26.1668 71.2376 26.8404C70.9154 27.1625 70.4761 27.3382 70.0368 27.3382Z" fill="currentColor" />
    <path d="M56.3751 27.3382C55.9358 27.3382 55.4965 27.1771 55.1597 26.8404C54.4861 26.1668 54.4861 25.0979 55.1597 24.4243L68.8215 10.7625C69.4951 10.0889 70.564 10.0889 71.2376 10.7625C71.9111 11.4361 71.9111 12.505 71.2376 13.1786L57.5758 26.8404C57.2536 27.1625 56.8144 27.3382 56.3751 27.3382Z" fill="currentColor" />
  </svg>
);

/** Thin trash icon (cart line remove). */
export const ThemeTrashIcon = (p: P) => (
  <svg width="13" height="15" viewBox="0 0 13 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...p}>
    <path d="M1 3.5h11M4.5 3.5V1.75c0-.41.34-.75.75-.75h2.5c.41 0 .75.34.75.75V3.5M2.5 3.5l.7 9.6c.04.5.46.9.97.9h4.66c.5 0 .93-.4.97-.9l.7-9.6M5.25 6.5v4.75M7.75 6.5v4.75" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
