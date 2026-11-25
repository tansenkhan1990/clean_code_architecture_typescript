import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createRedisCache } from "../../../src/infrastructure/redis/redis-cache.js";
import { createRedisIdempotencyStore } from "../../../src/infrastructure/redis/redis-idempotency-store.js";
import { createRedisRateLimiter } from "../../../src/infrastructure/redis/redis-rate-limiter.js";
import { connectRedis } from "../../../src/infrastructure/redis/redis-client.js";

/**
 * Real Redis, real `SET NX`. Skipped unless a URL is given:
 *
 *   docker compose up -d redis
 *   REDIS_TEST_URL=redis://127.0.0.1:6379 npm test
 */
const URL = process.env.REDIS_TEST_URL;

describe.skipIf(URL === undefined)("redis adapters", () => {
  let connection: Awaited<ReturnType<typeof connectRedis>>;

  beforeEach(async () => {
    connection = await connectRedis(URL as string);
    await connection.client.flushdb();
  });

  afterAll(async () => {
    if (connection !== undefined) {
      await connection.close();
    }
  });

  it("caches JSON values with a TTL", async () => {
    const cache = createRedisCache(connection.client);

    await cache.set("product:1", { id: "1", name: "Keyboard" }, 30);

    expect(await cache.get("product:1")).toEqual({
      id: "1",
      name: "Keyboard",
    });

    await cache.delete("product:1");
    expect(await cache.get("product:1")).toBeNull();
  });

  it("claims an idempotency key once and replays a saved outcome", async () => {
    const store = createRedisIdempotencyStore(connection.client);

    expect(await store.acquire("checkout:c1:k1", 30)).toBe("acquired");
    expect(await store.acquire("checkout:c1:k1", 30)).toBe("busy");

    await store.save(
      "checkout:c1:k1",
      { result: { orderId: "order-1" }, createdAt: "now" },
      60,
    );

    expect(await store.find("checkout:c1:k1")).toMatchObject({
      result: { orderId: "order-1" },
    });
    expect(await store.acquire("checkout:c1:k1", 30)).toBe("acquired");
  });

  it("limits a caller across shared connections", async () => {
    const limiter = createRedisRateLimiter(connection.client, {
      limit: 2,
      windowSeconds: 60,
    });

    expect((await limiter.consume("ip:/checkout")).allowed).toBe(true);
    expect((await limiter.consume("ip:/checkout")).allowed).toBe(true);

    const blocked = await limiter.consume("ip:/checkout");
    expect(blocked.allowed).toBe(false);
    expect(blocked.resetInSeconds).toBeGreaterThan(0);
  });
});
