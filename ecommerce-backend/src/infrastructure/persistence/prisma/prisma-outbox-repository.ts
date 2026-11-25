import type { PrismaClient } from "@prisma/client";
import type { OutboxRepository } from "../../../application/ports/outbox.js";
import { fromOutboxRow, toDate, toOutboxRow } from "./prisma-mappers.js";
import { currentPrismaClient } from "./prisma-session.js";

/**
 * Delivery scheduling is a query: unpublished, not dead-lettered, and past
 * `nextAttemptAt`. That keeps the backoff in the database, so a restart does
 * not reset it and a second worker sees the same truth.
 */
export function createPrismaOutboxRepository(
  prisma: PrismaClient,
): OutboxRepository {
  const db = () => currentPrismaClient() ?? prisma;

  return {
    async add(message) {
      await db().outboxMessage.create({ data: toOutboxRow(message) });
    },

    async findPending(limit, now) {
      const rows = await db().outboxMessage.findMany({
        where: {
          publishedAt: null,
          deadLetteredAt: null,
          nextAttemptAt: { lte: toDate(now) },
        },
        orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
        take: limit,
      });

      return rows.map(fromOutboxRow);
    },

    async markPublished(id, publishedAt) {
      await db().outboxMessage.update({
        where: { id },
        data: { publishedAt: toDate(publishedAt), lastError: null },
      });
    },

    async markFailed(id, failure) {
      await db().outboxMessage.update({
        where: { id },
        data: {
          attempts: { increment: 1 },
          lastError: failure.error,
          nextAttemptAt: toDate(failure.nextAttemptAt),
          deadLetteredAt:
            failure.deadLetteredAt === null
              ? null
              : toDate(failure.deadLetteredAt),
        },
      });
    },

    async findDeadLettered(limit) {
      const rows = await db().outboxMessage.findMany({
        where: { deadLetteredAt: { not: null } },
        orderBy: { deadLetteredAt: "asc" },
        take: limit,
      });

      return rows.map(fromOutboxRow);
    },
  };
}
