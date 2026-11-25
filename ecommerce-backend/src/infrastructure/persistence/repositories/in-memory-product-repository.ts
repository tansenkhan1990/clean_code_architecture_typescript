import type { ProductRepository } from "../../../application/ports/repositories/product-repository.js";
import type { InMemoryStoreRef } from "../in-memory/store.js";

export function createInMemoryProductRepository(
  store: InMemoryStoreRef,
): ProductRepository {
  return {
    async save(product) {
      store.current.products.set(product.id, { ...product });
    },

    async findById(id) {
      const product = store.current.products.get(id);
      return product ? { ...product } : null;
    },

    async findAll() {
      return [...store.current.products.values()].map((product) => ({
        ...product,
      }));
    },
  };
}
