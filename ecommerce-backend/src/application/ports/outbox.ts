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
  /** Retry scheduling: a failed message waits before it is picked up again. */
  nextAttemptAt: string;
  /** Set once the attempt budget is exhausted; the message is never retried. */
  deadLetteredAt: string | null;
};

export type OutboxFailure = {
  error: string;
  /** When the next attempt becomes eligible. */
  nextAttemptAt: string;
  /** Non-null when this failure exhausted the attempt budget. */
  deadLetteredAt: string | null;
};

/**
 * Storage contract for the outbox. `add` must run inside the same transaction
 * as the business write, otherwise the dual-write problem returns.
 */
export type OutboxRepository = {
  add(message: OutboxMessage): Promise<void>;
  /** Messages that are due: unpublished, not dead-lettered, past their backoff. */
  findPending(limit: number, now: string): Promise<OutboxMessage[]>;
  markPublished(id: string, publishedAt: string): Promise<void>;
  markFailed(id: string, failure: OutboxFailure): Promise<void>;
  /** Dead-lettered messages, for operators and tests. */
  findDeadLettered(limit: number): Promise<OutboxMessage[]>;
};
