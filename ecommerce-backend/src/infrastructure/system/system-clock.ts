import type { Clock } from "../../application/ports/clock.js";

/** ISO-8601 timestamps, in UTC, from the real clock. */
export function createSystemClock(): Clock {
  return {
    now: () => new Date().toISOString(),
  };
}
