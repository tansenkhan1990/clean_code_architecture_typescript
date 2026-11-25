import type { PrismaClient } from "@prisma/client";
import type { CustomerRepository } from "../../../application/ports/repositories/customer-repository.js";
import { fromCustomerRow, toCustomerRow } from "./prisma-mappers.js";
import { currentPrismaClient } from "./prisma-session.js";

export function createPrismaCustomerRepository(
  prisma: PrismaClient,
): CustomerRepository {
  const db = () => currentPrismaClient() ?? prisma;

  return {
    async save(customer) {
      const data = toCustomerRow(customer);

      await db().customer.upsert({
        where: { id: customer.id },
        create: data,
        update: data,
      });
    },

    async findById(id) {
      const row = await db().customer.findUnique({ where: { id } });
      return row === null ? null : fromCustomerRow(row);
    },

    async findByEmail(email) {
      const row = await db().customer.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      return row === null ? null : fromCustomerRow(row);
    },
  };
}
