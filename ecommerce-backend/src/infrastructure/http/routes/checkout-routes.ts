import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth-guards.js";
import type { CheckoutController } from "../controllers/checkout-controller.js";

export function registerCheckoutRoutes(
  app: FastifyInstance,
  controller: CheckoutController,
): void {
  app.post("/checkout", { preHandler: requireAuth }, controller.checkout);
}
