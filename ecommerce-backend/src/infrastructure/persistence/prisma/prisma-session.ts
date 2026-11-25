import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";

/**
 * Repositories need the transaction-scoped client to join a unit of work.
 * Threading it through every port would leak persistence into the
 * application, so it travels through async context instead, invisible to use
 * cases and identical in shape to the previous document-store adapter.
 */
const storage = new AsyncLocalStorage<Prisma.TransactionClient>();

export function runWithPrismaClient<T>(
  client: Prisma.TransactionClient,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(client, work);
}

export function currentPrismaClient(): Prisma.TransactionClient | undefined {
  return storage.getStore();
}
