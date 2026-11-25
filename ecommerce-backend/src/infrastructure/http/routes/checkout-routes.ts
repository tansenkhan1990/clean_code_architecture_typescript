import type { FastifyInstance } from "fastify";
import type { CheckoutController } from "../controllers/checkout-controller.js";

export function registerCheckoutRoutes(
  app: FastifyInstance,
  controller: CheckoutController,
): void {
  app.post("/checkout", controller.checkout);
}
