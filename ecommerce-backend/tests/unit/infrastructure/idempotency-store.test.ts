import { describe, expect, it } from "vitest";
import { createInMemoryIdempotencyStore } from "../../../src/infrastructure/idempotency/in-memory-idempotency-store.js";

describe("in-memory idempotency store", () => {
  it("lets exactly one caller claim a key", async () => {
    const store = createInMemoryIdempotencyStore();

    expect(await store.acquire("checkout:a:1", 30)).toBe("acquired");
    expect(await store.acquire("checkout:a:1", 30)).toBe("busy");
  });

  it("stores an outcome and frees the claim", async () => {
    const store = createInMemoryIdempotencyStore();

    await store.acquire("key", 30);
    await store.save(
      "key",
      { result: { id: "order-1" }, createdAt: "now" },
      60,
    );

    expect(await store.find("key")).toEqual({
      result: { id: "order-1" },
      createdAt: "now",
    });
    expect(await store.acquire("key", 30)).toBe("acquired");
  });

  it("releases a claim so a failed attempt can be retried", async () => {
    const store = createInMemoryIdempotencyStore();

    await store.acquire("key", 30);
    await store.release("key");

    expect(await store.acquire("key", 30)).toBe("acquired");
  });

  it("expires claims and records on their own", async () => {
    let clock = 0;
    const store = createInMemoryIdempotencyStore(() => clock);

    await store.acquire("key", 1);
    await store.save("key", { result: 1, createdAt: "now" }, 1);

    clock = 1_500;

    expect(await store.acquire("key", 1)).toBe("acquired");
    expect(await store.find("key")).toBeNull();
  });

  it("returns copies so stored outcomes cannot be mutated", async () => {
    const store = createInMemoryIdempotencyStore();
    const record = { result: { id: "order-1" }, createdAt: "now" };

    await store.save("key", record, 60);
    const found = await store.find<{ id: string }>("key");

    if (found === null) throw new Error("Expected a record");
    found.result.id = "changed";

    expect(await store.find("key")).toMatchObject({
      result: { id: "order-1" },
    });
  });
});
