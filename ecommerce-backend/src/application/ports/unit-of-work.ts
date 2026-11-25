import type { Result } from "../../domain/shared/result.js";

/**
 * The one failure infrastructure adds to a transaction: the boundary itself
 * could not be opened, committed, or rolled back. Business failures come from
 * the work, not from here.
 */
export type UnitOfWorkError = {
  type: "transaction_failed";
  message: string;
};

/**
 * "These changes commit together, or none of them do."
 *
 * The work returns a Result instead of throwing, which lets the port decide
 * from the *business* outcome whether to commit: a failure value rolls back.
 * Infrastructure implements this with a database transaction; the application
 * never learns whether that means PostgreSQL, an in-memory snapshot, or
 * anything else.
 */
export type UnitOfWork = {
  execute<T, E>(
    work: () => Promise<Result<T, E>>,
  ): Promise<Result<T, E | UnitOfWorkError>>;
};
