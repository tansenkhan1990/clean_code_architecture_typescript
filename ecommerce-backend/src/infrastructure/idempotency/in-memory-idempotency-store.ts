import type {
  IdempotencyRecord,
  IdempotencyReservation,
  IdempotencyStore,
} from "../../application/ports/idempotency-store.js";

type Entry = {
  record: IdempotencyRecord<unknown>;
  expiresAt: number;
};

type Claim = {
  expiresAt: number;
};

/**
 * Disposable idempotency storage. The API mirrors the Redis adapter that will
 * replace it: lookup by key, save with a TTL, an atomic claim, lazy expiry.
 *
 * "Atomic" here is honest for one Node process because `acquire` checks and
 * writes without yielding; Redis gets the same guarantee from `SET NX`.
 */
export function createInMemoryIdempotencyStore(
  now: () => number = Date.now,
): IdempotencyStore {
  const entries = new Map<string, Entry>();
  const claims = new Map<string, Claim>();

  return {
    async find<TResult>(key: string) {
      const entry = entries.get(key);

      if (entry === undefined) {
        return null;
      }

      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return null;
      }

      return structuredClone(entry.record) as IdempotencyRecord<TResult>;
    },

    async save<TResult>(
      key: string,
      record: IdempotencyRecord<TResult>,
      ttlSeconds: number,
    ) {
      entries.set(key, {
        record: structuredClone(record),
        expiresAt: now() + ttlSeconds * 1000,
      });
      claims.delete(key);
    },

    async acquire(
      key: string,
      ttlSeconds: number,
    ): Promise<IdempotencyReservation> {
      const current = claims.get(key);
      const timestamp = now();

      if (current !== undefined && current.expiresAt > timestamp) {
        return "busy";
      }

      claims.set(key, { expiresAt: timestamp + ttlSeconds * 1000 });
      return "acquired";
    },

    async release(key: string) {
      claims.delete(key);
    },
  };
}
