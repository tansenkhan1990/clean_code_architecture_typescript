import type { AccountRepository } from "../../../application/ports/repositories/account-repository.js";
import type { InMemoryStoreRef } from "../in-memory/store.js";

/** Copies on read and write so callers can never mutate stored state. */
export function createInMemoryAccountRepository(
  store: InMemoryStoreRef,
): AccountRepository {
  return {
    async save(account) {
      store.current.accounts.set(account.customerId, { ...account });
    },

    async findByCustomerId(customerId) {
      const account = store.current.accounts.get(customerId);
      return account ? { ...account } : null;
    },
  };
}
