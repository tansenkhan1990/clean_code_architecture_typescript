import type { FastifyInstance } from "fastify";
import type { RateLimiter } from "../../application/ports/rate-limiter.js";

const EXEMPT_PATHS = new Set(["/health", "/ready", "/metrics"]);

/**
 * A preHandler hook, not a business rule: it runs before validation and never
 * touches a use case. The limiter itself is a port, so this works the same
 * with Redis (shared across instances) or the in-memory fallback.
 *
 * If the limiter fails (Redis outage) the request is allowed through: refusing
 * all traffic because the counter store is down is worse than under-limiting.
 */
export function registerRateLimit(
  app: FastifyInstance,
  limiter: RateLimiter,
): void {
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;

    if (EXEMPT_PATHS.has(path)) {
      return;
    }

    const route =
      (request as { routeOptions?: { url?: string } }).routeOptions?.url ??
      path;

    try {
      const decision = await limiter.consume(`${request.ip}:${route}`);

      reply
        .header("x-ratelimit-limit", decision.limit)
        .header("x-ratelimit-remaining", decision.remaining)
        .header("x-ratelimit-reset", decision.resetInSeconds);

      if (!decision.allowed) {
        request.log.warn({ route, ip: request.ip }, "Rate limit exceeded");

        return reply
          .header("retry-after", decision.resetInSeconds)
          .code(429)
          .send({ message: "Too many requests" });
      }
    } catch (error) {
      request.log.error({ err: error }, "Rate limiter unavailable; allowing");
    }
  });
}
