import type { Cart } from "../../../domain/cart/cart.js";
import type { CustomerId } from "../../../domain/customer/customer-id.js";
import type { Money } from "../../../domain/product/money.js";
import type { Result } from "../../../domain/shared/result.js";
import type { CartRepository } from "../../ports/repositories/cart-repository.js";

export type GetCartInput = {
  customerId: CustomerId;
};

/**
 * A read model: the cart plus facts derived from it. Deriving them here means
 * the HTTP layer never does arithmetic.
 */
export type CartView = {
  cart: Cart;
  total: Money | null;
  itemCount: number;
};

export type GetCartError =
  | {
      type: "cart_not_found";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    };

export type GetCartDependencies = {
  carts: CartRepository;
};

export type GetCart = (
  input: GetCartInput,
) => Promise<Result<CartView, GetCartError>>;
