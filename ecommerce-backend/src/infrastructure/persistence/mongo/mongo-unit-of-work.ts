import { MongoError, type ClientSession, type MongoClient } from "mongodb";
import type {
  UnitOfWork,
  UnitOfWorkError,
} from "../../../application/ports/unit-of-work.js";
import type { Result } from "../../../domain/shared/result.js";
import { runWithMongoSession } from "./mongo-session.js";

/** A write conflict means the work should be re-run, not reported as failed. */
const MAX_ATTEMPTS = 3;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown transaction failure";
}

function isTransient(error: unknown): boolean {
  if (!(error instanceof MongoError)) {
    return false;
  }

  // `codeName` is on server errors, which the base class type does not model.
  const codeName = (error as { codeName?: string }).codeName;

  return (
    error.hasErrorLabel("TransientTransactionError") ||
    codeName === "WriteConflict" ||
    codeName === "NoSuchTransaction"
  );
}

async function abortQuietly(session: ClientSession): Promise<void> {
  try {
    await session.abortTransaction();
  } catch {
    // Already aborted or already committed; nothing left to undo.
  }
}

/**
 * MongoDB transactions need a replica set — the compose file runs a
 * single-node one, which is enough for real atomicity here.
 *
 * Commit happens only when the work returns `ok`. A business failure aborts;
 * a thrown error aborts and becomes `transaction_failed`; a transient write
 * conflict (two checkouts claiming the same stock) re-runs the work against
 * fresh data, up to three times. That last part is what a snapshot in memory
 * cannot model.
 */
export function createMongoUnitOfWork(client: MongoClient): UnitOfWork {
  return {
    async execute<T, E>(
      work: () => Promise<Result<T, E>>,
    ): Promise<Result<T, E | UnitOfWorkError>> {
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const session = client.startSession();

        try {
          session.startTransaction({
            readConcern: { level: "snapshot" },
            writeConcern: { w: "majority" },
          });

          const result = await runWithMongoSession(session, work);

          if (result.ok) {
            await session.commitTransaction();
          } else {
            await abortQuietly(session);
          }

          return result;
        } catch (error) {
          lastError = error;
          await abortQuietly(session);

          if (isTransient(error) && attempt < MAX_ATTEMPTS) {
            continue;
          }

          return {
            ok: false,
            error: { type: "transaction_failed", message: messageOf(error) },
          };
        } finally {
          await session.endSession();
        }
      }

      return {
        ok: false,
        error: { type: "transaction_failed", message: messageOf(lastError) },
      };
    },
  };
}
