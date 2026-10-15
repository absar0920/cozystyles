import { redirect } from 'next/navigation';

/** The live blog index is /blogs/news; /blogs is an alias. */
export default function BlogsPage() {
  redirect('/blogs/news');
}
