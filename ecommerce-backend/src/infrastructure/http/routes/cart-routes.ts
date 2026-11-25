import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth-guards.js";
import type { CartController } from "../controllers/cart-controller.js";

export function registerCartRoutes(
  app: FastifyInstance,
  controller: CartController,
): void {
  const preHandler = requireAuth;

  app.get("/customers/:customerId/cart", { preHandler }, controller.get);
  app.post(
    "/customers/:customerId/cart/items",
    { preHandler },
    controller.addItem,
  );
  app.delete(
    "/customers/:customerId/cart/items/:productId",
    { preHandler },
    controller.removeItem,
  );
}
