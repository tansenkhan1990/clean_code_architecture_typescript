import type { OrderRepository } from "../../../application/ports/repositories/order-repository.js";
import type { Order } from "../../../domain/order/order.js";
import type { InMemoryStoreRef } from "../in-memory/store.js";

function clone(order: Order): Order {
  return {
    ...order,
    items: order.items.map((item) => ({
      ...item,
      unitPrice: { ...item.unitPrice },
      lineTotal: { ...item.lineTotal },
    })),
    total: { ...order.total },
  };
}

/** Orders are append-only in practice; saving replaces the stored snapshot. */
export function createInMemoryOrderRepository(
  store: InMemoryStoreRef,
): OrderRepository {
  return {
    async save(order) {
      store.current.orders.set(order.id, clone(order));
    },

    async findById(id) {
      const order = store.current.orders.get(id);
      return order ? clone(order) : null;
    },

    async findByCustomerId(customerId) {
      return [...store.current.orders.values()]
        .filter((order) => order.customerId === customerId)
        .map(clone);
    },
  };
}
