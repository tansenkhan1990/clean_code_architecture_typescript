import type { FastifyInstance } from "fastify";
import type { CustomerController } from "../controllers/customer-controller.js";

/** Path to handler mapping only; no behaviour lives here. */
export function registerCustomerRoutes(
  app: FastifyInstance,
  controller: CustomerController,
): void {
  app.post("/customers", controller.create);
  app.get("/customers/:id", controller.getById);
}
