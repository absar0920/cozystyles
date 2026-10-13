import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#108474', // Interwood primary teal-green
          50: '#eaf5f3',
          100: '#d0ebe7',
          200: '#a3d7cf',
          300: '#6fbfae',
          400: '#3ea08d',
          500: '#108474',
          600: '#0d6f61',
          700: '#0a594e',
          800: '#084540',
          900: '#103a3a',
          950: '#052e2b',
        },
        ink: {
          DEFAULT: '#3d4246',
          dark: '#313131',
          muted: '#7b7b7b',
          light: '#969696',
        },
        cream: {
          DEFAULT: '#f6f6f0',
          soft: '#f9f9f9',
          border: '#ebebeb',
        },
        terra: { DEFAULT: '#c25b41', dark: '#a34a33' },
        sale: '#ae2828',
        orange: '#ff5f00',
        gold: '#a19a7e',
      },
      fontFamily: {
        heading: ['var(--font-poppins)', 'sans-serif'],
        body: ['var(--font-work-sans)', 'sans-serif'],
      },
      fontSize: {
        tiny: ['0.72rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        card: '0 1px 3px rgba(16,58,58,0.08), 0 4px 14px rgba(16,58,58,0.06)',
        hover: '0 6px 22px rgba(16,58,58,0.14)',
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

export default config;
