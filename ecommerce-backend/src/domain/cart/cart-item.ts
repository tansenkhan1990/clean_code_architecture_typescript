import type { Money } from "../product/money.js";
import type { ProductId } from "../product/product-id.js";
import { err, ok, type Result } from "../shared/result.js";
import type { CartDomainError } from "./cart-errors.js";

export const MAX_ITEM_QUANTITY = 99;

/**
 * A cart line remembers the price it was added at, so a price change does not
 * silently rewrite what the customer saw.
 */
export type CartItem = {
  productId: ProductId;
  quantity: number;
  unitPrice: Money;
};

export function createCartItem(input: {
  productId: ProductId;
  quantity: number;
  unitPrice: Money;
}): Result<CartItem, CartDomainError> {
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > MAX_ITEM_QUANTITY
  ) {
    return err({
      type: "invalid_cart_quantity",
      message: `Quantity must be a whole number between 1 and ${MAX_ITEM_QUANTITY}`,
    });
  }

  return ok({
    productId: input.productId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
  });
}

export function cartItemTotal(item: CartItem): Money {
  return {
    amountInMinorUnits: item.unitPrice.amountInMinorUnits * item.quantity,
    currency: item.unitPrice.currency,
  };
}
