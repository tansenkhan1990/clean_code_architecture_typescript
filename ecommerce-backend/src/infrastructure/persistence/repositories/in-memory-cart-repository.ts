import type { CartRepository } from "../../../application/ports/repositories/cart-repository.js";
import type { Cart } from "../../../domain/cart/cart.js";
import type { InMemoryStoreRef } from "../in-memory/store.js";

function clone(cart: Cart): Cart {
  return {
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      unitPrice: { ...item.unitPrice },
    })),
  };
}

export function createInMemoryCartRepository(
  store: InMemoryStoreRef,
): CartRepository {
  return {
    async save(cart) {
      store.current.carts.set(cart.id, clone(cart));
    },

    async findById(id) {
      const cart = store.current.carts.get(id);
      return cart ? clone(cart) : null;
    },

    async findByCustomerId(customerId) {
      for (const cart of store.current.carts.values()) {
        if (cart.customerId === customerId) {
          return clone(cart);
        }
      }

      return null;
    },
  };
}
