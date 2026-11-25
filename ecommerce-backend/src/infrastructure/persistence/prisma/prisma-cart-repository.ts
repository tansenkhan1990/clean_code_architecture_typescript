import type { PrismaClient } from "@prisma/client";
import type { CartRepository } from "../../../application/ports/repositories/cart-repository.js";
import { fromCartRow, toCartRow } from "./prisma-mappers.js";
import { currentPrismaClient } from "./prisma-session.js";

export function createPrismaCartRepository(
  prisma: PrismaClient,
): CartRepository {
  const db = () => currentPrismaClient() ?? prisma;

  return {
    async save(cart) {
      const data = toCartRow(cart);

      await db().cart.upsert({
        where: { id: cart.id },
        create: data,
        update: data,
      });
    },

    async findById(id) {
      const row = await db().cart.findUnique({ where: { id } });
      return row === null ? null : fromCartRow(row);
    },

    async findByCustomerId(customerId) {
      const row = await db().cart.findUnique({ where: { customerId } });
      return row === null ? null : fromCartRow(row);
    },
  };
}
