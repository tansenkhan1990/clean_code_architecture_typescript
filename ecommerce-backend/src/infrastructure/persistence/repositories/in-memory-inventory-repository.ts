import type { InventoryRepository } from "../../../application/ports/repositories/inventory-repository.js";
import type { InMemoryStoreRef } from "../in-memory/store.js";

/** Keyed by product, matching the port: one stock record per product. */
export function createInMemoryInventoryRepository(
  store: InMemoryStoreRef,
): InventoryRepository {
  return {
    async save(item) {
      store.current.inventory.set(item.productId, { ...item });
    },

    async findByProductId(productId) {
      const item = store.current.inventory.get(productId);
      return item ? { ...item } : null;
    },
  };
}
