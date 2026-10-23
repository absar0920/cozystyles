import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * Every address no other route matches (/sofa-sale, /products, /pages/a/b, …) lands here, so a mistyped
 * address shows the shop's own "Page not found" (../not-found.tsx) with the store header and footer, instead of
 * Next's bare 404. The response status stays 404.
 */
export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function UnknownAddress(): never {
  notFound();
}
