import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth-guards.js";
import type { CustomerController } from "../controllers/customer-controller.js";

/** Path to handler mapping only; no behaviour lives here. */
export function registerCustomerRoutes(
  app: FastifyInstance,
  controller: CustomerController,
): void {
  app.get("/customers/:id", { preHandler: requireAuth }, controller.getById);
}
