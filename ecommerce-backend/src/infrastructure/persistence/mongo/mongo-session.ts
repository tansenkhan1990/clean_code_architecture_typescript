import { AsyncLocalStorage } from "node:async_hooks";
import type { ClientSession } from "mongodb";

/**
 * Propagates the transaction's session to the repositories that participate in
 * it, without threading a `session` argument through every port.
 *
 * The boundary is still explicit where it matters — the use case calls
 * `unitOfWork.execute(...)` — and only this layer knows how the session
 * reaches the driver. A repository called outside a transaction simply gets no
 * session and runs on its own.
 */
const storage = new AsyncLocalStorage<ClientSession>();

export function runWithMongoSession<T>(
  session: ClientSession,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(session, work);
}

export function currentMongoSession(): ClientSession | undefined {
  return storage.getStore();
}

/** Spread into driver options so the operation joins the active transaction. */
export function sessionOptions(): { session?: ClientSession } {
  const session = currentMongoSession();

  return session === undefined ? {} : { session };
}
