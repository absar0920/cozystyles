/**
 * Anonymous visitor id for storefront rate limits (WhatsApp click logging).
 *
 * Route handlers can't see the socket address, so without a trusted proxy (`TRUSTED_PROXY_HOPS`) every caller
 * looks the same. The middleware gives each browser a signed `cz_visitor` cookie on its first page view; the click
 * logger then limits per visitor instead of per store, so a script posting forged clicks (no cookie, or one it
 * made up) can't use up the budget that real customers' clicks need.
 *
 * Uses Web Crypto so it runs in the middleware (edge runtime) and in route handlers alike.
 */

export const VISITOR_COOKIE = 'cz_visitor';
export const VISITOR_MAX_AGE_S = 60 * 60 * 24 * 365;

const encoder = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function key(): Promise<CryptoKey> | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  keyPromise ??= crypto.subtle.importKey(
    'raw',
    encoder.encode(`${secret}:visitor`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return keyPromise;
}

function toBase64Url(bytes: ArrayBuffer): string {
  let bin = '';
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const out = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** New signed token `${id}.${sig}`, or null when no secret is configured. */
export async function createVisitorToken(): Promise<string | null> {
  const k = key();
  if (!k) return null;
  const id = crypto.randomUUID().replace(/-/g, '');
  const sig = await crypto.subtle.sign('HMAC', await k, encoder.encode(id));
  return `${id}.${toBase64Url(sig)}`;
}

/** The visitor id when the token carries a valid signature, otherwise null. */
export async function verifyVisitorToken(token: string | undefined | null): Promise<string | null> {
  if (!token || token.length > 200) return null;
  const k = key();
  if (!k) return null;
  const [id, sig, extra] = token.split('.');
  if (!id || !sig || extra !== undefined || !/^[0-9a-f]{32}$/.test(id)) return null;
  const sigBytes = fromBase64Url(sig);
  if (!sigBytes) return null;
  const ok = await crypto.subtle.verify('HMAC', await k, sigBytes, encoder.encode(id));
  return ok ? id : null;
}

/** Reads the visitor cookie out of a raw `Cookie` header and verifies it. */
export async function visitorIdFromHeaders(headers: Headers): Promise<string | null> {
  const raw = headers.get('cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === VISITOR_COOKIE) {
      return verifyVisitorToken(decodeURIComponent(part.slice(eq + 1).trim()));
    }
  }
  return null;
}
