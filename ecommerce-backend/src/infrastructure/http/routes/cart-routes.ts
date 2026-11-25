import type { FastifyInstance } from "fastify";
import type { CartController } from "../controllers/cart-controller.js";

export function registerCartRoutes(
  app: FastifyInstance,
  controller: CartController,
): void {
  app.get("/customers/:customerId/cart", controller.get);
  app.post("/customers/:customerId/cart/items", controller.addItem);
  app.delete(
    "/customers/:customerId/cart/items/:productId",
    controller.removeItem,
  );
}
