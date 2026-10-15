import type { Metadata } from 'next';
import { Poppins, Work_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import { CartProvider } from '@/lib/cart';
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

export const metadata: Metadata = {
  title: {
    // live: "<page> - Interwood", home page just the store name
    default: 'Cozy Furnitures',
    template: '%s - Cozy Furnitures',
  },
  description:
    'Cozy Furnitures offers an exciting and affordable range of bedroom, living and office furniture, sofa sets, dining sets, kitchen designs, doors, wardrobes, flooring, home décor accessories and more to suit every style & space.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${poppinsThin.variable} ${workSans.variable}`}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
