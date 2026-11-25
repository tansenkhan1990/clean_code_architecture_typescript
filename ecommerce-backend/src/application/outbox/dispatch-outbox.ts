import { err, ok } from "../../domain/shared/result.js";
import type {
  DispatchOutbox,
  DispatchOutboxDependencies,
  OutboxDispatchSummary,
} from "./dispatch-outbox.types.js";

const DEFAULT_BATCH_SIZE = 50;

/**
 * The read side of the outbox: take pending messages, hand the broker-agnostic
 * event to the publisher, then mark the message delivered.
 *
 * The order matters. Marking before publishing would lose an event on a crash;
 * publishing twice after a crash is acceptable because consumers are expected
 * to be idempotent. That is the trade the outbox pattern makes.
 */
export function dispatchOutboxUseCase({
  outbox,
  publisher,
  clock,
  batchSize = DEFAULT_BATCH_SIZE,
}: DispatchOutboxDependencies): DispatchOutbox {
  return async () => {
    let pending;

    try {
      pending = await outbox.findPending(batchSize);
    } catch {
      return err({
        type: "outbox_unavailable",
        message: "Could not read pending outbox messages",
      });
    }

    const summary: OutboxDispatchSummary = { published: 0, failed: 0 };

    for (const message of pending) {
      try {
        await publisher.publish(message.event, { id: message.id });
        await outbox.markPublished(message.id, clock.now());
        summary.published += 1;
      } catch (error) {
        summary.failed += 1;

        try {
          await outbox.markFailed(
            message.id,
            error instanceof Error ? error.message : "Unknown delivery failure",
          );
        } catch {
          // The message stays pending, which is the safe state: it will be
          // picked up again on the next poll.
        }
      }
    }

    return ok(summary);
  };
}
