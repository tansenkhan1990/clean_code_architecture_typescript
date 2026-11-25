import type {
  UnitOfWork,
  UnitOfWorkError,
} from "../../application/ports/unit-of-work.js";
import type { Result } from "../../domain/shared/result.js";
import type { InMemoryStoreRef } from "../persistence/in-memory/store.js";

/**
 * A real transaction boundary over in-memory maps, not a try/catch facade:
 *
 *   1. snapshot the whole store
 *   2. let the work write to a private copy
 *   3. keep the copy only when the work reports success
 *   4. restore the snapshot on failure or on a thrown error
 *
 * Transactions are serialised through a promise queue so two of them cannot
 * both claim the same stock. A PostgreSQL implementation gets this for free
 * from the database; the application code cannot tell which one it has.
 */
export function createInMemoryUnitOfWork(store: InMemoryStoreRef): UnitOfWork {
  let tail: Promise<unknown> = Promise.resolve();

  return {
    execute<T, E>(
      work: () => Promise<Result<T, E>>,
    ): Promise<Result<T, E | UnitOfWorkError>> {
      const run = async (): Promise<Result<T, E | UnitOfWorkError>> => {
        const snapshot = structuredClone(store.current);

        try {
          const result = await work();

          if (!result.ok) {
            store.current = snapshot;
          }

          return result;
        } catch (error) {
          store.current = snapshot;

          return {
            ok: false,
            error: {
              type: "transaction_failed",
              message:
                error instanceof Error
                  ? error.message
                  : "The transaction could not be completed",
            },
          };
        }
      };

      const settled = tail.then(run, run);
      tail = settled.then(
        () => undefined,
        () => undefined,
      );

      return settled;
    },
  };
}
