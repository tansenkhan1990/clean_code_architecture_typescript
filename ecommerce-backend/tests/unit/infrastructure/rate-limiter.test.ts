import { describe, expect, it } from "vitest";
import { createInMemoryRateLimiter } from "../../../src/infrastructure/rate-limit/in-memory-rate-limiter.js";

describe("in-memory rate limiter", () => {
  it("allows the limit and rejects the next request", async () => {
    const limiter = createInMemoryRateLimiter({
      limit: 2,
      windowSeconds: 60,
    });

    expect(await limiter.consume("ip:/checkout")).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(await limiter.consume("ip:/checkout")).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(await limiter.consume("ip:/checkout")).toMatchObject({
      allowed: false,
      remaining: 0,
    });
  });

  it("counts callers independently", async () => {
    const limiter = createInMemoryRateLimiter({ limit: 1, windowSeconds: 60 });

    expect((await limiter.consume("a:/checkout")).allowed).toBe(true);
    expect((await limiter.consume("b:/checkout")).allowed).toBe(true);
    expect((await limiter.consume("a:/checkout")).allowed).toBe(false);
  });

  it("resets when the window elapses", async () => {
    let clock = 1_000;
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      windowSeconds: 10,
      now: () => clock,
    });

    expect((await limiter.consume("ip")).allowed).toBe(true);
    expect((await limiter.consume("ip")).allowed).toBe(false);

    clock += 10_000;

    expect((await limiter.consume("ip")).allowed).toBe(true);
  });
});
