import type { Cart } from "../../../domain/cart/cart.js";
import type { CustomerId } from "../../../domain/customer/customer-id.js";
import type { ProductId } from "../../../domain/product/product-id.js";
import type { Result } from "../../../domain/shared/result.js";
import type { Clock } from "../../ports/clock.js";
import type { CartRepository } from "../../ports/repositories/cart-repository.js";

export type RemoveItemInput = {
  customerId: CustomerId;
  productId: ProductId;
};

export type RemoveItemError =
  | {
      type: "cart_not_found";
      message: string;
    }
  | {
      type: "item_not_in_cart";
      message: string;
    }
  | {
      type: "repository_error";
      message: string;
    };

export type RemoveItemDependencies = {
  carts: CartRepository;
  clock: Clock;
};

export type RemoveItem = (
  input: RemoveItemInput,
) => Promise<Result<Cart, RemoveItemError>>;
