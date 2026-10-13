/**
 * Tiny in-memory rate limiter (fixed window).
 *
 * Counters live in a plain Map keyed by caller-chosen strings, e.g.
 * `login:admin@x`, `lookup:IW-100001:1.2.3.4`, `contact:1.2.3.4`.
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

/** Best-effort client IP for rate-limit keys (behind a proxy this is X-Forwarded-For). */
export function clientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
