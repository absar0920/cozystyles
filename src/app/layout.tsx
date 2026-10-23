import type { Metadata } from 'next';
import { Poppins, Work_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { siteName } from '@/lib/site-url';
import './globals.css';

// Live theme font: Poppins everywhere (body, headings, buttons, prices, footer). Live loads only the
// 400–700 faces, so a computed weight 100–300 (badges, SEO links, delivery line…) renders as 400 there;
// loading no lighter face here gives the same rendering.
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
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
const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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
