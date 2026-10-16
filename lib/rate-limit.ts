export interface RateLimiterOptions {
  capacity: number;
  refillPerMs: number;
  now: () => number;
}

export interface RateLimiter {
  allow(key: string): boolean;
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
