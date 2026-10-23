import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { siteName } from '@/lib/site-url';
import './globals.css';

// Live theme font: Poppins everywhere (body, headings, buttons, prices, footer). Live loads only the
// 400–700 faces, so a computed weight 100–300 (badges, SEO links, delivery line…) renders as 400 there;
// loading no lighter face here gives the same rendering.
// The font files are stored in src/fonts (latin subset from Google Fonts), so the build never downloads them:
// a production build on the hosting server must not depend on reaching Google Fonts.
const poppins = localFont({
  src: [
    { path: '../fonts/poppins-400-latin.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/poppins-400-italic-latin.woff2', weight: '400', style: 'italic' },
    { path: '../fonts/poppins-500-latin.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/poppins-500-italic-latin.woff2', weight: '500', style: 'italic' },
    { path: '../fonts/poppins-600-latin.woff2', weight: '600', style: 'normal' },
    { path: '../fonts/poppins-600-italic-latin.woff2', weight: '600', style: 'italic' },
    { path: '../fonts/poppins-700-latin.woff2', weight: '700', style: 'normal' },
    { path: '../fonts/poppins-700-italic-latin.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-poppins',
  display: 'swap',
});

// Thin Poppins (200, self-hosted under its own family name so the theme's Poppins never picks it up)
// for our own artwork only: the logo wordmark and catalogue cover lettering (`font-poppins-thin`).
const poppinsThin = localFont({
  src: '../../public/fonts/poppins-200-latin.woff2',
  weight: '200',
  style: 'normal',
  variable: '--font-poppins-thin',
  display: 'swap',
});

// Live Globo mega menu font: Work Sans, used only by the main nav + dropdowns.
const workSans = localFont({
  src: '../fonts/work-sans-variable-latin.woff2', // one variable file covers weights 400–600
  weight: '400 600',
  style: 'normal',
  variable: '--font-work-sans',
  display: 'swap',
});

const SITE_NAME = siteName();

export const metadata: Metadata = {
  title: {
    // live: "<page> - Interwood", home page just the store name
    default: SITE_NAME,
    template: `%s - ${SITE_NAME}`,
  },
  // The home page's (and any page without its own) description for search engines: plain and true for any shop
  // built on this site — no product ranges, payment methods or services it might not offer.
  description: `Browse ${SITE_NAME} online: our furniture collections, with photos, prices and details for every product.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${poppinsThin.variable} ${workSans.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
