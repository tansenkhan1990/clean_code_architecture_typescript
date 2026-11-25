/**
 * The recorded outcome of an operation that already happened, keyed by the
 * caller's idempotency key. Replays return this instead of doing the work
 * again, so a retried checkout cannot create a second order.
 */
export type IdempotencyRecord<TResult> = {
  result: TResult;
  createdAt: string;
};

/**
 * `acquired` means this request owns the key and may do the work; `busy`
 * means another request is already doing it, so this one must not start.
 */
export type IdempotencyReservation = "acquired" | "busy";

/**
 * Short-lived storage for idempotent request outcomes. Redis implements this
 * in production with `SET NX` and a TTL; the in-memory adapter exists for tests
 * and local runs. The port knows nothing about either.
 *
 * `acquire` is the part that closes the double-charge race: two simultaneous
 * requests with the same unused key cannot both receive `acquired`.
 */
export type IdempotencyStore = {
  find<TResult>(key: string): Promise<IdempotencyRecord<TResult> | null>;
  save<TResult>(
    key: string,
    record: IdempotencyRecord<TResult>,
    ttlSeconds: number,
  ): Promise<void>;
  acquire(key: string, ttlSeconds: number): Promise<IdempotencyReservation>;
  /** Frees a claim that did not produce a stored outcome (a decline, a crash). */
  release(key: string): Promise<void>;
};
