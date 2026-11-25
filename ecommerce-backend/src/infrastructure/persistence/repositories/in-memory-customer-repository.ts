import type { CustomerRepository } from "../../../application/ports/repositories/customer-repository.js";
import type { InMemoryStoreRef } from "../in-memory/store.js";

/** Copies on read and write so callers can never mutate stored state. */
export function createInMemoryCustomerRepository(
  store: InMemoryStoreRef,
): CustomerRepository {
  return {
    async save(customer) {
      store.current.customers.set(customer.id, { ...customer });
    },

    async findById(id) {
      const customer = store.current.customers.get(id);
      return customer ? { ...customer } : null;
    },

    async findByEmail(email) {
      const normalized = email.trim().toLowerCase();

      for (const customer of store.current.customers.values()) {
        if (customer.email === normalized) {
          return { ...customer };
        }
      }

      return null;
    },
  };
}
