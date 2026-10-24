import type { MetadataRoute } from 'next';
import { robotsRules } from '@/lib/seo';

/** /robots.txt: the live shop lets crawlers in and points them to the sitemap; staging and local copies shut them out. */
export default function robots(): MetadataRoute.Robots {
  return robotsRules();
}
