import type { Cache } from "../../application/ports/cache.js";

type Entry = {
  value: unknown;
  expiresAt: number;
};

/**
 * A disposable cache. The clock is injectable so expiry is testable without
 * waiting, and entries are removed on read once they are stale.
 */
export function createInMemoryCache(now: () => number = Date.now): Cache {
  const entries = new Map<string, Entry>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = entries.get(key);

      if (entry === undefined) {
        return null;
      }

      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }

      return entry.value as T;
    },

    async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
      entries.set(key, {
        value,
        expiresAt: now() + ttlSeconds * 1000,
      });
    },

    async delete(key: string): Promise<void> {
      entries.delete(key);
    },
  };
}
