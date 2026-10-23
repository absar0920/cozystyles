import { SITE } from './constants';

/**
 * The shop's own public address and name, from the deployment's environment:
 *   NEXT_PUBLIC_SITE_URL  — e.g. "https://cozystyle.pk" (the canonical host; www is redirected to it)
 *   NEXT_PUBLIC_SITE_NAME — e.g. "Cozy Furnitures"
 * NEXT_PUBLIC_* values are inlined into both the server and the browser code, so these give the same answer on
 * either side. Safe to import anywhere (no React); in client components use `useSiteHost()` for a host that
 * falls back to the address the admin is open on.
 */

function siteUrl(): URL | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** "https://cozystyle.pk" — null when NEXT_PUBLIC_SITE_URL is unset or not a valid address. */
export function siteOrigin(): string | null {
  return siteUrl()?.origin ?? null;
}

/** "cozystyle.pk" (with the port when there is one) — null when NEXT_PUBLIC_SITE_URL is unset or invalid. */
export function siteHost(): string | null {
  return siteUrl()?.host || null;
}

/** The shop's name as customers see it. */
export function siteName(): string {
  return process.env.NEXT_PUBLIC_SITE_NAME?.trim() || SITE.name;
}
