import { Redis } from "ioredis";

export type RedisConnection = {
  client: Redis;
  close(): Promise<void>;
  check(): Promise<void>;
};

/**
 * One connection shared by the cache, idempotency, and rate limiting adapters.
 * `lazyConnect` keeps start-up honest: the composition root decides when to
 * connect, and a failed connection surfaces at that point instead of later.
 */
export async function connectRedis(url: string): Promise<RedisConnection> {
  const client = new Redis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    connectTimeout: 5_000,
  });

  client.on("error", (error) => {
    console.error("Redis connection error", error.message);
  });

  await client.connect();

  return {
    client,
    async close() {
      await client.quit();
    },
    async check() {
      await client.ping();
    },
  };
}
