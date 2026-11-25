import type { PrismaClient } from "@prisma/client";
import type { InventoryRepository } from "../../../application/ports/repositories/inventory-repository.js";
import { fromInventoryRow, toInventoryRow } from "./prisma-mappers.js";
import { currentPrismaClient } from "./prisma-session.js";

export function createPrismaInventoryRepository(
  prisma: PrismaClient,
): InventoryRepository {
  const db = () => currentPrismaClient() ?? prisma;

  return {
    async save(item) {
      const data = toInventoryRow(item);

      // The unique index on productId is the storage guarantee: one stock
      // record per product, whichever id the aggregate happens to carry.
      await db().inventoryItem.upsert({
        where: { productId: item.productId },
        create: data,
        update: data,
      });
    },

    async findByProductId(productId) {
      const row = await db().inventoryItem.findUnique({
        where: { productId },
      });
      return row === null ? null : fromInventoryRow(row);
    },
  };
}
