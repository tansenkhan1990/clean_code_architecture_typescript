import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { HealthCheck } from "../../../src/infrastructure/health/health-check.js";
import { buildHttpApp } from "../../../src/infrastructure/http/fastify.js";
import { createMetrics } from "../../../src/infrastructure/observability/metrics.js";
import { createInMemoryRateLimiter } from "../../../src/infrastructure/rate-limit/in-memory-rate-limiter.js";
import {
  createTestAuth,
  createTestEnvironment,
} from "../../support/test-environment.js";

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

const healthy: HealthCheck = { name: "postgres", check: async () => undefined };
const broken: HealthCheck = {
  name: "redis",
  check: async () => {
    throw new Error("connection refused");
  },
};

describe("platform endpoints", () => {
  it("reports readiness as ok when every dependency answers", async () => {
    app = buildHttpApp({
      controllers: createTestEnvironment().controllers,
      tokens: createTestAuth().tokens,
      logger: false,
      healthChecks: [healthy],
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      checks: { postgres: "up" },
    });
  });

  it("returns 503 when a dependency is down", async () => {
    app = buildHttpApp({
      controllers: createTestEnvironment().controllers,
      tokens: createTestAuth().tokens,
      logger: false,
      healthChecks: [healthy, broken],
    });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "degraded",
      checks: { postgres: "up", redis: "down" },
    });
  });

  it("exposes Prometheus metrics for handled requests", async () => {
    const metrics = createMetrics();

    app = buildHttpApp({
      controllers: createTestEnvironment().controllers,
      tokens: createTestAuth().tokens,
      logger: false,
      metrics,
    });
    await app.ready();

    await app.inject({ method: "GET", url: "/products" });

    const response = await app.inject({ method: "GET", url: "/metrics" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.body).toContain("http_requests_total");
    expect(response.body).toContain('route="/products"');
    expect(response.body).toContain("checkout_total");
  });

  it("echoes a caller-supplied request id", async () => {
    app = buildHttpApp({
      controllers: createTestEnvironment().controllers,
      tokens: createTestAuth().tokens,
      logger: false,
    });
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/health",
      headers: { "x-request-id": "trace-abc" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBe("trace-abc");
  });

  it("limits callers, exempts health routes, and returns Retry-After", async () => {
    app = buildHttpApp({
      controllers: createTestEnvironment().controllers,
      tokens: createTestAuth().tokens,
      logger: false,
      rateLimiter: createInMemoryRateLimiter({ limit: 2, windowSeconds: 60 }),
    });
    await app.ready();

    await app.inject({ method: "GET", url: "/health" });
    await app.inject({ method: "GET", url: "/health" });
    await app.inject({ method: "GET", url: "/health" });

    const first = await app.inject({ method: "GET", url: "/products" });
    const second = await app.inject({ method: "GET", url: "/products" });
    const third = await app.inject({ method: "GET", url: "/products" });

    expect(first.statusCode).toBe(200);
    expect(first.headers["x-ratelimit-limit"]).toBe("2");
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
    expect(third.headers["retry-after"]).toBeDefined();
    expect(third.json()).toEqual({ message: "Too many requests" });
  });
});
