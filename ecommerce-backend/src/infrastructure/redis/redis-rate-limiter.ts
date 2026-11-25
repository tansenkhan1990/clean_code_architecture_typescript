import type { Redis } from "ioredis";
import type {
  RateLimitDecision,
  RateLimiter,
} from "../../application/ports/rate-limiter.js";

/**
 * INCR plus EXPIRE must be one step, otherwise a crash between them leaves a
 * counter with no window and the caller is limited forever. A short Lua script
 * runs atomically inside Redis.
 */
const LUA = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { count, ttl }
`;

export type RedisRateLimiterOptions = {
  limit: number;
  windowSeconds: number;
  prefix?: string;
};

export function createRedisRateLimiter(
  client: Redis,
  { limit, windowSeconds, prefix = "ratelimit:" }: RedisRateLimiterOptions,
): RateLimiter {
  return {
    async consume(key): Promise<RateLimitDecision> {
      const response = (await client.eval(
        LUA,
        1,
        `${prefix}${key}`,
        windowSeconds,
      )) as [number, number];

      const count = response[0] ?? 0;
      const ttl = response[1] ?? windowSeconds;

      return {
        allowed: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        resetInSeconds: ttl > 0 ? ttl : windowSeconds,
      };
    },
  };
}
