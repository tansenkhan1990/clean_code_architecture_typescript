import type { DispatchOutbox } from "../../application/outbox/dispatch-outbox.types.js";

export type OutboxWorkerOptions = {
  dispatch: DispatchOutbox;
  intervalMs: number;
  onError?: (error: unknown) => void;
};

export type OutboxWorker = {
  start(): void;
  stop(): Promise<void>;
  /** Runs one poll immediately; useful for tests and for shutdown flushing. */
  runOnce(): Promise<void>;
};

/**
 * The scheduling half of the outbox. It knows nothing about events, only when
 * to ask the application to drain a batch. A cron job or a queue-based worker
 * can replace it without touching the dispatcher.
 */
export function createOutboxWorker({
  dispatch,
  intervalMs,
  onError = (error) => console.error("Outbox dispatch failed", error),
}: OutboxWorkerOptions): OutboxWorker {
  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight: Promise<void> | null = null;
  let stopped = false;

  const poll = async (): Promise<void> => {
    if (inFlight !== null) {
      return inFlight;
    }

    inFlight = (async () => {
      const result = await dispatch();

      if (!result.ok) {
        onError(result.error);
      }
    })()
      .catch(onError)
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };

  return {
    start() {
      if (timer !== null || stopped) {
        return;
      }

      timer = setInterval(() => {
        void poll();
      }, intervalMs);
    },

    async runOnce() {
      await poll();
    },

    async stop() {
      stopped = true;

      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }

      if (inFlight !== null) {
        await inFlight;
      }
    },
  };
}
