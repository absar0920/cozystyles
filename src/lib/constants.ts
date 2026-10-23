/**
 * Site-wide fallback constants. The shop's contact details (phone, email, address, WhatsApp number…) are SiteSetting
 * keys edited in Admin → Settings, with no built-in fallback: a detail that is not set is left out on the store.
 * The shop name comes from NEXT_PUBLIC_SITE_NAME (`siteName()` in src/lib/site-url.ts), falling back to this one.
 */
export const SITE = {
  name: 'Cozy Furnitures',
};
