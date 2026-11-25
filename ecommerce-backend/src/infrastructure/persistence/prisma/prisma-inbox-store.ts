import type { PrismaClient } from "@prisma/client";
import type { InboxStore } from "../../../application/ports/inbox-store.js";

/**
 * `createMany` with `skipDuplicates` becomes `INSERT ... ON CONFLICT DO
 * NOTHING`: the unique primary key decides the winner, the row count says
 * whether this caller is the first delivery, and a duplicate is not an
 * exception to log. No read-then-write window.
 */
export function createPrismaInboxStore(prisma: PrismaClient): InboxStore {
  return {
    async markProcessed({ id, eventName, processedAt }) {
      const { count } = await prisma.processedEvent.createMany({
        data: [{ id, eventName, processedAt: new Date(processedAt) }],
        skipDuplicates: true,
      });

      return count === 1;
    },

    async hasProcessed(id) {
      const row = await prisma.processedEvent.findUnique({ where: { id } });
      return row !== null;
    },
  };
}
