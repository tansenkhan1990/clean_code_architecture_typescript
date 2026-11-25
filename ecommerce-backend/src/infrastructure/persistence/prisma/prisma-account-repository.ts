import type { PrismaClient } from "@prisma/client";
import type { AccountRepository } from "../../../application/ports/repositories/account-repository.js";
import { fromAccountRow, toAccountRow } from "./prisma-mappers.js";
import { currentPrismaClient } from "./prisma-session.js";

export function createPrismaAccountRepository(
  prisma: PrismaClient,
): AccountRepository {
  const db = () => currentPrismaClient() ?? prisma;

  return {
    async save(account) {
      const data = toAccountRow(account);

      await db().account.upsert({
        where: { customerId: account.customerId },
        create: data,
        update: data,
      });
    },

    async findByCustomerId(customerId) {
      const row = await db().account.findUnique({ where: { customerId } });
      return row === null ? null : fromAccountRow(row);
    },
  };
}
