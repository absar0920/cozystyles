import { redirect } from 'next/navigation';

/** Live-site parity: /collections/all-1 shows the full catalogue. */
export default function AllOneCollectionRedirect() {
  redirect('/collections/all');
}
