'use client';

import { useSyncExternalStore } from 'react';
import { siteHost } from './site-url';

const subscribe = () => () => {};

/**
 * The shop's host for the grey text in front of admin "Web address" boxes ("cozystyle.pk" + "/products/…"):
 * NEXT_PUBLIC_SITE_URL's host, else the host the admin is open on. Without the variable the server render has
 * no host to show (''), and the browser fills it in right after hydration.
 */
export function useSiteHost(): string {
  return useSyncExternalStore(
    subscribe,
    () => siteHost() ?? window.location.host,
    () => siteHost() ?? '',
  );
}
