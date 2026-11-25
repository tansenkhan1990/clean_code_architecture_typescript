import type { DomainEvent } from "../../domain/shared/domain-event.js";

/**
 * A domain event captured for later delivery, written in the same transaction
 * as the state it describes.
 *
 * It deliberately contains no Kafka topic, partition key, header, or offset:
 * the outbox is a persistence reliability pattern, not a message broker. A
 * Kafka producer is one possible *reader* of these rows.
 */
export type OutboxMessage = {
  id: string;
  event: DomainEvent;
  createdAt: string;
  publishedAt: string | null;
  attempts: number;
  lastError: string | null;
};

/**
 * Storage contract for the outbox. `add` must run inside the same transaction
 * as the business write, otherwise the dual-write problem returns.
 */
export type OutboxRepository = {
  add(message: OutboxMessage): Promise<void>;
  findPending(limit: number): Promise<OutboxMessage[]>;
  markPublished(id: string, publishedAt: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
};
