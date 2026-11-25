/**
 * A fixed-window counter: "this caller may do N things per window".
 *
 * The application asks whether an action is allowed; whether the counter lives
 * in Redis, in memory, or in front of the process is infrastructure's business.
 */
export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the current window resets. */
  resetInSeconds: number;
};

export type RateLimiter = {
  consume(key: string): Promise<RateLimitDecision>;
};
