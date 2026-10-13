import { redirect } from 'next/navigation';

/** Live-site parity: /collections/frontpage shows the full catalogue. */
export default function FrontpageCollectionRedirect() {
  redirect('/collections/all');
}
