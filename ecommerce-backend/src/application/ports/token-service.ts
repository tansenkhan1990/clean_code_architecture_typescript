import type { Principal } from "../auth/principal.js";

export type AccessToken = {
  token: string;
  /** ISO-8601 instant, so clients can refresh before expiry. */
  expiresAt: string;
};

export type TokenService = {
  issue(principal: Principal): Promise<AccessToken>;
  /** Returns `null` for a malformed, expired, or wrongly signed token. */
  verify(token: string): Promise<Principal | null>;
};
