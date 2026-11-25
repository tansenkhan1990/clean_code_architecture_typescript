import { randomUUID } from "node:crypto";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { RateLimiter } from "../../application/ports/rate-limiter.js";
import type { TokenService } from "../../application/ports/token-service.js";
import type { HealthCheck } from "../health/health-check.js";
import type { Metrics } from "../observability/metrics.js";
import { registerAuthentication } from "./auth-guards.js";
import type { AuthController } from "./controllers/auth-controller.js";
import type { CartController } from "./controllers/cart-controller.js";
import type { CheckoutController } from "./controllers/checkout-controller.js";
import type { CustomerController } from "./controllers/customer-controller.js";
import type { OrderController } from "./controllers/order-controller.js";
import type { ProductController } from "./controllers/product-controller.js";
import { registerHealthRoutes } from "./health-routes.js";
import { registerRateLimit } from "./rate-limit.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerCartRoutes } from "./routes/cart-routes.js";
import { registerCheckoutRoutes } from "./routes/checkout-routes.js";
import { registerCustomerRoutes } from "./routes/customer-routes.js";
import { registerOrderRoutes } from "./routes/order-routes.js";
import { registerProductRoutes } from "./routes/product-routes.js";

export type HttpControllers = {
  auth: AuthController;
  customers: CustomerController;
  products: ProductController;
  carts: CartController;
  orders: OrderController;
  checkout: CheckoutController;
};

type HttpAppOptions = {
  controllers: HttpControllers;
  /** Verifies the bearer token that guards protected routes. */
  tokens: TokenService;
  logger?: boolean;
  /** Omitted in tests that do not care about limiting. */
  rateLimiter?: RateLimiter;
  /** Tighter budget for register/login; falls back to unlimited in tests. */
  authRateLimiter?: RateLimiter;
  metrics?: Metrics;
  healthChecks?: HealthCheck[];
};

/**
 * Builds the HTTP adapter. It never listens, so tests can drive the real
 * routes and error handler through `inject` without a socket.
 *
 * Request ids are honoured from `x-request-id` when the caller supplies one,
 * which is what makes logs and traces joinable across services.
 */
export function buildHttpApp({
  controllers,
  tokens,
  logger = true,
  rateLimiter,
  authRateLimiter,
  metrics,
  healthChecks = [],
}: HttpAppOptions): FastifyInstance {
  const app = Fastify({
    logger,
    genReqId: (request) => {
      const incoming = request.headers["x-request-id"];

      return typeof incoming === "string" &&
        incoming.length > 0 &&
        incoming.length <= 128
        ? incoming
        : randomUUID();
    },
  });

  if (metrics !== undefined) {
    app.addHook("onResponse", async (request, reply) => {
      const route =
        (request as { routeOptions?: { url?: string } }).routeOptions?.url ??
        request.url;

      metrics.observeHttpRequest({
        method: request.method,
        route,
        statusCode: reply.statusCode,
        durationSeconds: reply.elapsedTime / 1000,
      });
    });
  }

  // Cheap, dependency-free defaults. Anything that would need a policy
  // decision per route (CSP, CORS) is left to the deployment edge.
  app.addHook("onSend", async (request, reply, payload) => {
    reply.header("x-request-id", request.id);
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");

    // Token and profile responses must never be stored by a shared cache.
    if (request.url.startsWith("/auth/")) {
      reply.header("cache-control", "no-store");
    }

    return payload;
  });

  // Authentication is extracted once for every route; the guards decide who
  // may continue, and public routes simply ignore a missing principal.
  registerAuthentication(app, tokens);

  registerHealthRoutes(app, {
    checks: healthChecks,
    ...(metrics === undefined ? {} : { metrics }),
  });

  registerAuthRoutes(app, controllers.auth, authRateLimiter);
  registerCustomerRoutes(app, controllers.customers);
  registerProductRoutes(app, controllers.products);
  registerCartRoutes(app, controllers.carts);
  registerOrderRoutes(app, controllers.orders);
  registerCheckoutRoutes(app, controllers.checkout);

  if (rateLimiter !== undefined) {
    registerRateLimit(app, rateLimiter);
  }

  // Unexpected failures are logged once, here, and answered without detail.
  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as FastifyError;
    const statusCode = fastifyError.statusCode ?? 500;

    if (statusCode >= 500) {
      request.log.error({ err: fastifyError }, "Unhandled request error");
      return reply.code(500).send({ message: "Internal server error" });
    }

    return reply.code(statusCode).send({ message: fastifyError.message });
  });

  return app;
}
