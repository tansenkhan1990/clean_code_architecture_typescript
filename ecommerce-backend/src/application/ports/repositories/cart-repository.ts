import type { Cart, CartId } from "../../../domain/cart/cart.js";
import type { CustomerId } from "../../../domain/customer/customer-id.js";

/** One open cart per customer, which is why lookup is by customer. */
export type CartRepository = {
  save(cart: Cart): Promise<void>;
  findById(id: CartId): Promise<Cart | null>;
  findByCustomerId(customerId: CustomerId): Promise<Cart | null>;
};
