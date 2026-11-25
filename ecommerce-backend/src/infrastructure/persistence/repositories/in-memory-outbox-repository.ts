import type { OutboxRepository } from "../../../application/ports/outbox.js";
import type { InMemoryStoreRef } from "../in-memory/store.js";

export function createInMemoryOutboxRepository(
  store: InMemoryStoreRef,
): OutboxRepository {
  return {
    async add(message) {
      store.current.outbox.set(message.id, structuredClone(message));
    },

    async findPending(limit) {
      return [...store.current.outbox.values()]
        .filter((message) => message.publishedAt === null)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
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
      });
    },

    async markFailed(id, error) {
      const message = store.current.outbox.get(id);

      if (message === undefined) {
        return;
      }

      store.current.outbox.set(id, {
        ...structuredClone(message),
        attempts: message.attempts + 1,
        lastError: error,
      });
    },
  };
}
