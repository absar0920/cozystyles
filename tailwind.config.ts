/**
 * Design tokens mirror the live theme (Shopify "Habitat" + Globo mega menu) CSS variables.
 *
 * Written as CommonJS on purpose: Node 22 loads this .ts natively, and an ESM config gets pinned in
 * Node's ESM cache, so `next dev` would never pick up token edits without a restart.
 */
/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    // live theme breakpoints (min-width): medium 768, sticky-header 981, large 1068, wide nav ≥1261.
    // Declared in full (not extended) so the media queries are emitted in ascending order.
    screens: {
      sm: '640px',
      md: '768px',
      hd: '981px',
      lg: '1068px',
      xl: '1261px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        // --color-accent: text, prices, icons, solid buttons
        accent: '#103a3a',
        // --color-accent2: link hover, badges, cart count, accent2 button
        accent2: '#c25b41',
        brand: {
          DEFAULT: '#103a3a', // live accent; the old #108474 teal is not used in the live chrome
          50: '#eaf5f3',
          100: '#d0ebe7',
          200: '#a3d7cf',
          300: '#6fbfae',
          400: '#3ea08d',
          500: '#108474', // Judge.me widget teal (reviews only)
          600: '#0d6f61',
          700: '#0a594e',
          800: '#084540',
          900: '#103a3a',
          950: '#052e2b',
        },
        judge: '#108474',
        ink: {
          DEFAULT: '#103a3a', // live body text = accent
          dark: '#313131', // mega-menu links
          muted: '#7b7b7b',
          light: '#969696',
          seo: '#333333', // footer SEO links
        },
        cream: {
          DEFAULT: '#f6f6f0', // --color-accent3: footer bg, announcement text
          soft: '#f9f9f9',
          border: '#ebebeb',
        },
        panel: '#fafafa', // side-panel footer (cart drawer)
        line: '#eeeeee', // --color-border
        formline: '#dedede', // --color-form-border
        maroon: '#63221e', // announcement CTA + Wedding Packages nav item
        menuRed: '#ae2828', // mega-menu column headings
        megaline: '#d1d1d1', // mega-menu panel border
        leaf: '#21b259', // logo mark / store-locator green
        terra: { DEFAULT: '#c25b41', dark: '#a34a33' },
        sale: '#ae2828',
        soldout: '#939393',
        limited: '#e3c565',
        star: '#f1b824',
        orange: '#ff5f00',
        gold: '#a19a7e',
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
        'poppins-thin': ['var(--font-poppins-thin)', 'Poppins', 'sans-serif'],
        heading: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
        body: ['var(--font-poppins)', 'Poppins', 'sans-serif'],
        nav: ['var(--font-work-sans)', '"Work Sans"', 'sans-serif'],
        stars: ['Times', '"Times New Roman"', 'serif'],
      },
      spacing: {
        '4.5': '1.125rem',
        '5.5': '1.375rem',
        '13': '3.25rem',
      },
      fontSize: {
        tiny: ['0.72rem', { lineHeight: '1rem' }],
      },
      letterSpacing: {
        btn: '.2em',
        title: '.1em',
        ann: '.15em',
        badge: '.05em',
        soft: '.02em',
      },
      borderRadius: {
        btn: '3px',
      },
      boxShadow: {
        header: '0 -14px 20px #000',
        search: '0 10px 15px rgba(0,0,0,.1)',
        totop: '0 1px 6px rgba(0,0,0,.1)',
        card: '0 1px 3px rgba(16,58,58,0.08), 0 4px 14px rgba(16,58,58,0.06)',
        hover: '0 6px 22px rgba(16,58,58,0.14)',
      },
      transitionTimingFunction: {
        theme: 'cubic-bezier(.104,.204,.492,1)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
        fadeIn: 'fadeIn .35s ease-out both',
      },
    },
  },
  plugins: [],
};

module.exports = config;
