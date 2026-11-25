import type { FastifyInstance } from "fastify";
import { requireAdmin, requireAuth } from "../auth-guards.js";
import type { ProductController } from "../controllers/product-controller.js";

/**
 * The catalogue is public; writing to it is an administrative action. The role
 * check is a route guard here because it depends on nothing but the token.
 */
export function registerProductRoutes(
  app: FastifyInstance,
  controller: ProductController,
): void {
  app.post(
    "/products",
    { preHandler: [requireAuth, requireAdmin] },
    controller.create,
  );
  app.get("/products", controller.list);
  app.get("/products/:id", controller.getById);
}
