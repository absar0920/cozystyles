import type { Metadata } from 'next';
import { Poppins, Work_Sans } from 'next/font/google';
import { CartProvider } from '@/lib/cart';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
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
    default: 'Interwood — Pakistan’s Largest Furniture Manufacturer',
    template: '%s | Interwood',
  },
  description:
    'We offer an exciting and affordable range of bedroom, living and office furniture, sofa sets, dining sets, kitchen designs, doors, wardrobes, flooring, home décor accessories and more to suit every style & space.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${workSans.variable}`}>
      <body>
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
