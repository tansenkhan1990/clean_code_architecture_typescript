import { Prisma, type PrismaClient } from "@prisma/client";
import type { InboxStore } from "../../../application/ports/inbox-store.js";

/**
 * `create` plus a unique primary key is the atomic check-and-set: two
 * consumers racing on the same event cannot both insert, and the loser gets
 * P2002, which means "already processed". No read-then-write window.
 */
export function createPrismaInboxStore(prisma: PrismaClient): InboxStore {
  return {
    async markProcessed({ id, eventName, processedAt }) {
      try {
        await prisma.processedEvent.create({
          data: { id, eventName, processedAt: new Date(processedAt) },
        });

        return true;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return false;
        }

        throw error;
      }
    },

    async hasProcessed(id) {
      const row = await prisma.processedEvent.findUnique({ where: { id } });
      return row !== null;
    },
  };
}
