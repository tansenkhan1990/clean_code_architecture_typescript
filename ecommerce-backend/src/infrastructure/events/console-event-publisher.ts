import type { EventPublisher } from "../../application/ports/event-publisher.js";
import type { DomainEvent } from "../../domain/shared/domain-event.js";

/**
 * The in-process publisher: it writes events to stdout as JSON lines, which is
 * exactly the payload shape a log collector or broker producer expects. A
 * Kafka producer replaces this without touching the use cases.
 */
export function createConsoleEventPublisher(
  publish: (event: DomainEvent) => void = (event) =>
    console.log(JSON.stringify(event)),
): EventPublisher {
  return {
    async publish(event) {
      publish(event);
    },
  };
}
