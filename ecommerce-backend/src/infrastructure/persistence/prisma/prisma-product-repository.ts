import type { PrismaClient } from "@prisma/client";
import type { ProductRepository } from "../../../application/ports/repositories/product-repository.js";
import { fromProductRow, toProductRow } from "./prisma-mappers.js";
import { currentPrismaClient } from "./prisma-session.js";

export function createPrismaProductRepository(
  prisma: PrismaClient,
): ProductRepository {
  const db = () => currentPrismaClient() ?? prisma;

  return {
    async save(product) {
      const data = toProductRow(product);

      await db().product.upsert({
        where: { id: product.id },
        create: data,
        update: data,
      });
    },

    async findById(id) {
      const row = await db().product.findUnique({ where: { id } });
      return row === null ? null : fromProductRow(row);
    },

    async findAll() {
      const rows = await db().product.findMany({
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });

      return rows.map(fromProductRow);
    },
  };
}
