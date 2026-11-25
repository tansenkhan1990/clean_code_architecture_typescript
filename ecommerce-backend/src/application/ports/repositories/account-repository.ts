import type { Account } from "../../../domain/auth/account.js";

/** Credentials are keyed by the customer they belong to, one account each. */
export type AccountRepository = {
  save(account: Account): Promise<void>;
  findByCustomerId(customerId: string): Promise<Account | null>;
};
