import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth-guards.js";
import type { OrderController } from "../controllers/order-controller.js";

export function registerOrderRoutes(
  app: FastifyInstance,
  controller: OrderController,
): void {
  const preHandler = requireAuth;

  app.post("/orders", { preHandler }, controller.create);
  app.get("/orders/:id", { preHandler }, controller.getById);
  app.post("/orders/:id/cancel", { preHandler }, controller.cancel);
  app.post("/orders/:id/pay", { preHandler }, controller.pay);
}
