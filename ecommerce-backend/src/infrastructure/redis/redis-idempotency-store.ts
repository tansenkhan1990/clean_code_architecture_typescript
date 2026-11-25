import type { Redis } from "ioredis";
import type {
  IdempotencyRecord,
  IdempotencyReservation,
  IdempotencyStore,
} from "../../application/ports/idempotency-store.js";

const RECORD_PREFIX = "idempotency:record:";
const CLAIM_PREFIX = "idempotency:claim:";

/**
 * `SET NX EX` is the whole trick: the first request to claim a key wins, and
 * every concurrent retry gets `busy` instead of running the checkout again.
 *
 * The claim and the record are separate keys on purpose. Saving the record
 * removes the claim, so a *completed* retry replays, while an *in-flight*
 * retry is refused with 409 rather than double-charging.
 */
export function createRedisIdempotencyStore(client: Redis): IdempotencyStore {
  return {
    async find<TResult>(key: string) {
      const raw = await client.get(`${RECORD_PREFIX}${key}`);

      if (raw === null) {
        return null;
      }

      try {
        return JSON.parse(raw) as IdempotencyRecord<TResult>;
      } catch {
        return null;
      }
    },

    async save<TResult>(
      key: string,
      record: IdempotencyRecord<TResult>,
      ttlSeconds: number,
    ) {
      await client
        .multi()
        .set(`${RECORD_PREFIX}${key}`, JSON.stringify(record), "EX", ttlSeconds)
        .del(`${CLAIM_PREFIX}${key}`)
        .exec();
    },

    async acquire(
      key: string,
      ttlSeconds: number,
    ): Promise<IdempotencyReservation> {
      const result = await client.set(
        `${CLAIM_PREFIX}${key}`,
        "1",
        "EX",
        ttlSeconds,
        "NX",
      );

      return result === "OK" ? "acquired" : "busy";
    },

    async release(key: string) {
      await client.del(`${CLAIM_PREFIX}${key}`);
    },
  };
}
