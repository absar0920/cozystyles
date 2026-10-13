import { redirect } from 'next/navigation';

/** Live-site parity: /blogs/blog is an alias of the blog index. */
export default function BlogsBlogAliasPage() {
  redirect('/blogs');
}
