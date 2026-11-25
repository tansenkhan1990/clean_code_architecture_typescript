import type { OutboxRepository } from "../../../application/ports/outbox.js";
import type { InMemoryStoreRef } from "../in-memory/store.js";

export function createInMemoryOutboxRepository(
  store: InMemoryStoreRef,
): OutboxRepository {
  return {
    async add(message) {
      store.current.outbox.set(message.id, structuredClone(message));
    },

    async findPending(limit, now) {
      return [...store.current.outbox.values()]
        .filter(
          (message) =>
            message.publishedAt === null &&
            message.deadLetteredAt === null &&
            message.nextAttemptAt <= now,
        )
        .sort((left, right) =>
          left.nextAttemptAt.localeCompare(right.nextAttemptAt),
        )
        .slice(0, limit)
        .map((message) => structuredClone(message));
    },

    async markPublished(id, publishedAt) {
      const message = store.current.outbox.get(id);

      if (message === undefined) {
        return;
      }

      store.current.outbox.set(id, {
        ...structuredClone(message),
        publishedAt,
        lastError: null,
      });
    },

    async markFailed(id, failure) {
      const message = store.current.outbox.get(id);

      if (message === undefined) {
        return;
      }

      store.current.outbox.set(id, {
        ...structuredClone(message),
        attempts: message.attempts + 1,
        lastError: failure.error,
        nextAttemptAt: failure.nextAttemptAt,
        deadLetteredAt: failure.deadLetteredAt,
      });
    },

    async findDeadLettered(limit) {
      return [...store.current.outbox.values()]
        .filter((message) => message.deadLetteredAt !== null)
        .sort((left, right) =>
          (left.deadLetteredAt ?? "").localeCompare(right.deadLetteredAt ?? ""),
        )
        .slice(0, limit)
        .map((message) => structuredClone(message));
    },
  };
}
