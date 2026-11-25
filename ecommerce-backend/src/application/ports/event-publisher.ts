import type { DomainEvent } from "../../domain/shared/domain-event.js";

/**
 * Envelope metadata that travels with an event but is not part of it. The id
 * is the outbox message id, which gives consumers a stable key to deduplicate
 * at-least-once delivery on.
 */
export type EventEnvelope = {
  id: string;
};

/** Publishing is I/O, so the application depends on this contract only. */
export type EventPublisher = {
  publish(event: DomainEvent, envelope: EventEnvelope): Promise<void>;
};
