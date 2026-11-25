import type { OutboxMessage } from "../../../application/ports/outbox.js";
import type { Cart, CartId } from "../../../domain/cart/cart.js";
import type { Customer } from "../../../domain/customer/customer.js";
import type { CustomerId } from "../../../domain/customer/customer-id.js";
import type { InventoryItem } from "../../../domain/inventory/inventory-item.js";
import type { Order, OrderId } from "../../../domain/order/order.js";
import type { Product } from "../../../domain/product/product.js";
import type { ProductId } from "../../../domain/product/product-id.js";

/** Every table the in-memory adapters keep, in one swappable object. */
export type InMemoryStore = {
  customers: Map<CustomerId, Customer>;
  products: Map<ProductId, Product>;
  inventory: Map<ProductId, InventoryItem>;
  carts: Map<CartId, Cart>;
  orders: Map<OrderId, Order>;
  outbox: Map<string, OutboxMessage>;
};

/**
 * Repositories read `store.current` on every operation instead of capturing a
 * Map. That indirection is what lets the transaction adapter swap in a private
 * copy and restore the previous one on rollback.
 */
export type InMemoryStoreRef = {
  current: InMemoryStore;
};

export function createInMemoryStore(): InMemoryStoreRef {
  return {
    current: {
      customers: new Map(),
      products: new Map(),
      inventory: new Map(),
      carts: new Map(),
      orders: new Map(),
      outbox: new Map(),
    },
  };
}
