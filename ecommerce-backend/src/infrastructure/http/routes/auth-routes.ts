import type { FastifyInstance } from "fastify";
import type { RateLimiter } from "../../../application/ports/rate-limiter.js";
import { requireAuth } from "../auth-guards.js";
import type { AuthController } from "../controllers/auth-controller.js";
import { createAuthRateLimitHook } from "../rate-limit.js";

/**
 * Authentication endpoints get a tighter budget than the rest of the API, and
 * `/auth/me` proves the token round trip. No route here ever returns a hash.
 */
export function registerAuthRoutes(
  app: FastifyInstance,
  controller: AuthController,
  rateLimiter?: RateLimiter,
): void {
  const authOptions =
    rateLimiter === undefined
      ? {}
      : { preHandler: createAuthRateLimitHook(rateLimiter) };

  app.post("/auth/register", authOptions, controller.register);
  app.post("/auth/login", authOptions, controller.login);
  app.get("/auth/me", { preHandler: requireAuth }, controller.me);
}
