import {
  cartItemCount,
  cartTotal,
  type Cart,
} from "../../../domain/cart/cart.js";
import { err, ok } from "../../../domain/shared/result.js";
import type { GetCart, GetCartDependencies } from "./get-cart.types.js";

export function getCartUseCase({ carts }: GetCartDependencies): GetCart {
  return async ({ customerId }) => {
    let cart: Cart | null;

    try {
      cart = await carts.findByCustomerId(customerId);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load cart",
      });
    }

    if (cart === null) {
      return err({
        type: "cart_not_found",
        message: `No cart exists for customer ${customerId}`,
      });
    }

    return ok({
      cart,
      total: cartTotal(cart),
      itemCount: cartItemCount(cart),
    });
  };
}
