export interface RateLimiterOptions {
  capacity: number;
  refillPerMs: number;
  now: () => number;
}

export interface RateLimiter {
  allow(key: string): boolean;
}

/**
 * Best-effort client IP for rate-limit keying. `x-real-ip` is set by a trusted
 * reverse proxy; otherwise take the *rightmost* X-Forwarded-For entry, which
 * is appended by the nearest proxy. The leftmost entries are client-controlled
 * and trivially spoofed. Deployments directly exposed to the internet (no
 * proxy) should set `x-real-ip` at the edge, otherwise all clients share the
 * "unknown" bucket.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) {
      return last;
    }
  }
  return "unknown";
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const { capacity, refillPerMs, now } = options;
  const buckets = new Map<string, { tokens: number; last: number }>();

  return {
    allow(key: string): boolean {
      const t = now();
      const bucket = buckets.get(key) ?? { tokens: capacity, last: t };
      const elapsed = t - bucket.last;
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillPerMs);
      bucket.last = t;

      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        buckets.set(key, bucket);
        return true;
      }
      buckets.set(key, bucket);
      return false;
    },
  };
}
