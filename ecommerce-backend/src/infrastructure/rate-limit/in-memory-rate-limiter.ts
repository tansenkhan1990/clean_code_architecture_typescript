import type {
  RateLimitDecision,
  RateLimiter,
} from "../../application/ports/rate-limiter.js";

export type InMemoryRateLimiterOptions = {
  limit: number;
  windowSeconds: number;
  /** Injectable so tests can move time without sleeping. */
  now?: () => number;
};

type Window = {
  count: number;
  resetAt: number;
};

/**
 * A per-process fixed window: correct for one instance, and the fallback when
 * Redis is not configured. With several instances it undercounts, which is why
 * the Redis adapter exists.
 */
export function createInMemoryRateLimiter({
  limit,
  windowSeconds,
  now = Date.now,
}: InMemoryRateLimiterOptions): RateLimiter {
  const windows = new Map<string, Window>();
  const windowMs = windowSeconds * 1000;

  return {
    async consume(key): Promise<RateLimitDecision> {
      const timestamp = now();
      const existing = windows.get(key);

      if (existing === undefined || existing.resetAt <= timestamp) {
        windows.set(key, { count: 1, resetAt: timestamp + windowMs });

        return {
          allowed: true,
          limit,
          remaining: Math.max(0, limit - 1),
          resetInSeconds: windowSeconds,
        };
      }

      existing.count += 1;

      return {
        allowed: existing.count <= limit,
        limit,
        remaining: Math.max(0, limit - existing.count),
        resetInSeconds: Math.max(
          1,
          Math.ceil((existing.resetAt - timestamp) / 1000),
        ),
      };
    },
  };
}
