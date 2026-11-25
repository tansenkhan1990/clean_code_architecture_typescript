import type { DomainEvent } from "../../domain/shared/domain-event.js";
import type { Clock } from "../ports/clock.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { OutboxRepository } from "../ports/outbox.js";

export type StageEventDependencies = {
  outbox: OutboxRepository;
  ids: IdGenerator;
  clock: Clock;
};

/**
 * Records an event for later delivery. It must be called inside the same
 * transaction as the business write, which is the whole point: either both the
 * state change and the event are committed, or neither is.
 */
export function stageEvent(
  { outbox, ids, clock }: StageEventDependencies,
  event: DomainEvent,
): Promise<void> {
  const now = clock.now();

  return outbox.add({
    id: ids.nextId(),
    event,
    createdAt: now,
    publishedAt: null,
    attempts: 0,
    lastError: null,
    nextAttemptAt: now,
    deadLetteredAt: null,
  });
}
