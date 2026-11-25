/**
 * The consumer side of at-least-once delivery: record the event id in the same
 * transaction as the work it triggers, so a redelivery is recognised.
 *
 * `markProcessed` returns false when the id was already recorded, which is the
 * signal to skip the handler. It is an insert-and-see, not a read-then-write:
 * the unique constraint is what makes it safe under concurrency.
 */
export type InboxStore = {
  markProcessed(input: {
    id: string;
    eventName: string;
    processedAt: string;
  }): Promise<boolean>;
  hasProcessed(id: string): Promise<boolean>;
};
