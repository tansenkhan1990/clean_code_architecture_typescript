import {
  removeItem as removeItemFromCart,
  type Cart,
} from "../../../domain/cart/cart.js";
import { err, ok } from "../../../domain/shared/result.js";
import type {
  RemoveItem,
  RemoveItemDependencies,
} from "./remove-item.types.js";

export function removeItemUseCase({
  carts,
  clock,
}: RemoveItemDependencies): RemoveItem {
  return async (input) => {
    let cart: Cart | null;

    try {
      cart = await carts.findByCustomerId(input.customerId);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load cart",
      });
    }

    if (cart === null) {
      return err({
        type: "cart_not_found",
        message: `No cart exists for customer ${input.customerId}`,
      });
    }

    const updated = removeItemFromCart(cart, input.productId, clock.now());

    if (!updated.ok) {
      return err({
        type: "item_not_in_cart",
        message: updated.error.message,
      });
    }

    try {
      await carts.save(updated.value);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not save cart",
      });
    }

    return ok(updated.value);
  };
}
