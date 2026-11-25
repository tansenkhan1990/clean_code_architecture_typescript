import type { Redis } from "ioredis";
import type { Cache } from "../../application/ports/cache.js";

/** JSON is the wire format; keys are namespaced so Redis stays inspectable. */
export function createRedisCache(client: Redis, prefix = "cache:"): Cache {
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await client.get(`${prefix}${key}`);

      if (raw === null) {
        return null;
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        // A corrupt entry is a cache miss, never a request failure.
        await client.del(`${prefix}${key}`);
        return null;
      }
    },

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      await client.set(
        `${prefix}${key}`,
        JSON.stringify(value),
        "EX",
        ttlSeconds,
      );
    },

    async delete(key: string): Promise<void> {
      await client.del(`${prefix}${key}`);
    },
  };
}
