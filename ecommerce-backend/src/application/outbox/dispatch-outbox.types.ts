import type { Result } from "../../domain/shared/result.js";
import type { Clock } from "../ports/clock.js";
import type { EventPublisher } from "../ports/event-publisher.js";
import type { OutboxRepository } from "../ports/outbox.js";

export type OutboxDispatchSummary = {
  published: number;
  failed: number;
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
 * Drains pending messages. A single failed delivery is recorded on the message
 * and the batch continues, so one poison event cannot block the rest. Retrying
 * is the worker's job, not this function's.
 */
export type DispatchOutbox = () => Promise<
  Result<OutboxDispatchSummary, OutboxDispatchError>
>;
