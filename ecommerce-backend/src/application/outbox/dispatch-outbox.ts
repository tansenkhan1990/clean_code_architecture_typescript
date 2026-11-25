import { err, ok } from "../../domain/shared/result.js";
import { isDeadLettered, retryDelayMs } from "./backoff.js";
import type {
  DispatchOutbox,
  DispatchOutboxDependencies,
  OutboxDispatchSummary,
} from "./dispatch-outbox.types.js";

const DEFAULT_BATCH_SIZE = 50;

/**
 * The read side of the outbox: take messages that are due, hand the
 * broker-agnostic event to the publisher, then mark the message delivered.
 *
 * On failure the message keeps its place with a later `nextAttemptAt`
 * (exponential backoff) and, once the attempt budget is spent, is
 * dead-lettered rather than retried forever. Publishing before marking is
 * deliberate: a crash can duplicate an event, but can never lose one.
 */
export function dispatchOutboxUseCase({
  outbox,
  publisher,
  clock,
  batchSize = DEFAULT_BATCH_SIZE,
}: DispatchOutboxDependencies): DispatchOutbox {
  return async () => {
    const now = clock.now();
    let pending;

    try {
      pending = await outbox.findPending(batchSize, now);
    } catch {
      return err({
        type: "outbox_unavailable",
        message: "Could not read pending outbox messages",
      });
    }

    const summary: OutboxDispatchSummary = {
      published: 0,
      failed: 0,
      deadLettered: 0,
    };

    for (const message of pending) {
      try {
        await publisher.publish(message.event, { id: message.id });
        await outbox.markPublished(message.id, clock.now());
        summary.published += 1;
      } catch (error) {
        summary.failed += 1;

        const attempts = message.attempts + 1;
        const deadLettered = isDeadLettered(attempts);
        const failedAt = clock.now();

        if (deadLettered) {
          summary.deadLettered += 1;
        }

        try {
          await outbox.markFailed(message.id, {
            error:
              error instanceof Error
                ? error.message
                : "Unknown delivery failure",
            nextAttemptAt: deadLettered
              ? failedAt
              : new Date(
                  new Date(failedAt).getTime() + retryDelayMs(attempts),
                ).toISOString(),
            deadLetteredAt: deadLettered ? failedAt : null,
          });
        } catch {
          // The message stays pending with its previous schedule, which is the
          // safe state: it will be considered again on the next poll.
        }
      }
    }

    return ok(summary);
  };
}
