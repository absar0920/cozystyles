import { redirect } from 'next/navigation';

/** Live-site parity: /blogs/news is the canonical blog index — alias of /blogs. */
export default function BlogsNewsIndexPage() {
  redirect('/blogs');
}
