/**
 * Tiny in-memory rate limiter (fixed window).
 *
 * Counters live in a plain Map keyed by caller-chosen strings, e.g.
 * `login:admin@x`, `pw:12`, `wa:1.2.3.4`, `contact:1.2.3.4`.
 * This is per-process — fine for this single-node VPS deployment where the
 * app runs as one Next.js server. If the app is ever scaled horizontally,
 * swap this for a shared store (e.g. Redis).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Sweep expired buckets once the map grows large so memory stays bounded. */
const MAX_BUCKETS = 10_000;
function sweep(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  /** false → limit exceeded; reject the request (429) until the window resets. */
  ok: boolean;
  /** Attempts counted in the current window, including this one. */
  count: number;
  /** Milliseconds until the window resets (0 when ok). */
  retryAfterMs: number;
};

/**
 * Count one attempt against `key` and report whether it is still allowed.
 * The window opens on the first attempt and lasts `windowMs`; a fixed maximum
 * of `limit` attempts is allowed per window.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, count: 1, retryAfterMs: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, count: bucket.count, retryAfterMs: Math.max(0, bucket.resetAt - now) };
  }
  return { ok: true, count: bucket.count, retryAfterMs: 0 };
}

/** Clear a key's window — call after a successful attempt to start fresh. */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/**
 * Number of reverse proxies in front of the app that append to `X-Forwarded-For` (env `TRUSTED_PROXY_HOPS`,
 * default 0). Only the entries those proxies added can be trusted; anything to their left was sent by the client.
 */
function trustedProxyHops(): number {
  const n = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10) : 0;
}

/**
 * Client IP for rate-limit keys, read only from headers that can't be forged.
 *
 * - `TRUSTED_PROXY_HOPS=N` (e.g. 1 behind one nginx using `$proxy_add_x_forwarded_for`): the N-th
 *   `X-Forwarded-For` entry from the right, i.e. the address our outermost proxy saw. Entries further left are
 *   client-supplied and ignored.
 * - Unset / 0 (the app is reached directly): the headers are entirely client-controlled, and App Router route
 *   handlers can't see the socket address, so every caller shares the `'unknown'` key. Per-IP limits then act as
 *   one global limit, which is safe (spoofing the header can't buy extra attempts) but strict — set the variable in
 *   production behind a proxy.
 */
export function clientIpFromHeaders(headers: Headers): string {
  return clientIp(headers) ?? 'unknown';
}

/** Same as `clientIpFromHeaders`, but `null` when the address can't be trusted (no proxy configured). */
export function clientIp(headers: Headers): string | null {
  const hops = trustedProxyHops();
  if (hops === 0) return null;
  const chain = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length < hops) return null;
  return chain[chain.length - hops] || null;
}
