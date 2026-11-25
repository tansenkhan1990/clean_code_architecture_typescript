import type { FastifyInstance } from "fastify";
import type { OrderController } from "../controllers/order-controller.js";

export function registerOrderRoutes(
  app: FastifyInstance,
  controller: OrderController,
): void {
  app.post("/orders", controller.create);
  app.get("/orders/:id", controller.getById);
  app.post("/orders/:id/cancel", controller.cancel);
  app.post("/orders/:id/pay", controller.pay);
}
