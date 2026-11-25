import type { Result } from "../../domain/shared/result.js";
import type { Clock } from "../ports/clock.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { OutboxRepository } from "../ports/outbox.js";

export type OutboxDispatchSummary = {
  published: number;
  failed: number;
  deadLettered: number;
};

export type OutboxDispatchError = {
  type: "outbox_unavailable";
  message: string;
};

export type DispatchOutboxDependencies = {
  outbox: OutboxRepository;
  publisher: EventPublisher;
  clock: Clock;
  batchSize?: number;
};

/**
 * Drains due messages. A single failed delivery is recorded on the message, its
 * next attempt is scheduled with exponential backoff, and the batch continues
 * so one poison event cannot block the rest. After the attempt budget it is
 * dead-lettered instead of retried forever.
 */
export type DispatchOutbox = () => Promise<
  Result<OutboxDispatchSummary, OutboxDispatchError>
>;
