import type { FastifyInstance } from "fastify";
import type { ProductController } from "../controllers/product-controller.js";

export function registerProductRoutes(
  app: FastifyInstance,
  controller: ProductController,
): void {
  app.post("/products", controller.create);
  app.get("/products", controller.list);
  app.get("/products/:id", controller.getById);
}
