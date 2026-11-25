/** After this many failed deliveries the message is dead-lettered. */
export const MAX_DELIVERY_ATTEMPTS = 5;

const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 60_000;

/**
 * Exponential backoff with a ceiling: 1s, 2s, 4s, 8s, then capped at 60s.
 * The dispatcher asks for this instead of retrying immediately, so a broker
 * outage does not turn into a hot loop against the broker and the database.
 */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);

  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** exponent);
}

export function isDeadLettered(attempts: number): boolean {
  return attempts >= MAX_DELIVERY_ATTEMPTS;
}
