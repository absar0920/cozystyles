import type { Metadata } from 'next';
import { Nunito, Work_Sans } from 'next/font/google';
import { CartProvider } from '@/lib/cart';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-poppins', // keep the CSS var name; token consumers stay untouched
  display: 'swap',
});

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-work-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Cozy Furnitures — Comfortable, Affordable Furniture for Every Home',
    template: '%s | Cozy Furnitures',
  },
  description:
    'Cozy Furnitures offers an exciting and affordable range of bedroom, living and office furniture, sofa sets, dining sets, kitchen designs, doors, wardrobes, flooring, home décor accessories and more to suit every style & space.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} ${workSans.variable}`}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
