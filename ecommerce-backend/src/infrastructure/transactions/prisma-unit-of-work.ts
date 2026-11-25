import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  UnitOfWork,
  UnitOfWorkError,
} from "../../application/ports/unit-of-work.js";
import type { Result } from "../../domain/shared/result.js";
import { runWithPrismaClient } from "../persistence/prisma/prisma-session.js";

const MAX_ATTEMPTS = 3;

/** P2034 is Prisma's write-conflict / deadlock code: retry the transaction. */
const WRITE_CONFLICT = "P2034";

/** Thrown inside `$transaction` to turn a business failure into a rollback. */
class RollbackSignal extends Error {
  readonly result: Result<unknown, unknown>;

  constructor(result: Result<unknown, unknown>) {
    super("transaction rolled back");
    this.result = result;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Transaction failed";
}

function isWriteConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === WRITE_CONFLICT
  );
}

/**
 * A real PostgreSQL transaction. The work runs inside `$transaction`; a
 * business failure is signalled by throwing a sentinel, because returning a
 * failure value would commit the partial work. A write conflict (two checkouts
 * claiming the same stock) is retried against fresh data.
 *
 * Serializable isolation is deliberate: the read-check-write in
 * `create-order` must not interleave with another reservation.
 */
export function createPrismaUnitOfWork(prisma: PrismaClient): UnitOfWork {
  return {
    async execute<T, E>(
      work: () => Promise<Result<T, E>>,
    ): Promise<Result<T, E | UnitOfWorkError>> {
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          return await prisma.$transaction(
            async (tx) => {
              const result = await runWithPrismaClient(tx, work);

              if (!result.ok) {
                throw new RollbackSignal(result);
              }

              return result;
            },
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              maxWait: 5_000,
              timeout: 15_000,
            },
          );
        } catch (error) {
          if (error instanceof RollbackSignal) {
            return error.result as Result<T, E | UnitOfWorkError>;
          }

          lastError = error;

          if (isWriteConflict(error) && attempt < MAX_ATTEMPTS) {
            continue;
          }

          return {
            ok: false,
            error: { type: "transaction_failed", message: messageOf(error) },
          };
        }
      }

      return {
        ok: false,
        error: { type: "transaction_failed", message: messageOf(lastError) },
      };
    },
  };
}
