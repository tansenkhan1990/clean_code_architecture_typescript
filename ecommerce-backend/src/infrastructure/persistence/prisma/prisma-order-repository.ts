import type { PrismaClient } from "@prisma/client";
import type { OrderRepository } from "../../../application/ports/repositories/order-repository.js";
import { fromOrderRow, toOrderRow } from "./prisma-mappers.js";
import { currentPrismaClient } from "./prisma-session.js";

export function createPrismaOrderRepository(
  prisma: PrismaClient,
): OrderRepository {
  const db = () => currentPrismaClient() ?? prisma;

  return {
    async save(order) {
      const data = toOrderRow(order);

      await db().order.upsert({
        where: { id: order.id },
        create: data,
        update: data,
      });
    },

    async findById(id) {
      const row = await db().order.findUnique({ where: { id } });
      return row === null ? null : fromOrderRow(row);
    },

    async findByCustomerId(customerId) {
      const rows = await db().order.findMany({
        where: { customerId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      return rows.map(fromOrderRow);
    },
  };
}
