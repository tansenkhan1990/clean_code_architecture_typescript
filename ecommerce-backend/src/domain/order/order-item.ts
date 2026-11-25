import type { CartItem } from "../cart/cart-item.js";
import { multiplyMoney, type Money } from "../product/money.js";
import type { ProductId } from "../product/product-id.js";
import { err, ok, type Result } from "../shared/result.js";
import type { OrderDomainError } from "./order-errors.js";

/**
 * A line of a placed order. It snapshots name-free price data, so later
 * product edits cannot change what the customer agreed to pay.
 */
export type OrderItem = {
  productId: ProductId;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
};

export function createOrderItem(input: {
  productId: ProductId;
  quantity: number;
  unitPrice: Money;
}): Result<OrderItem, OrderDomainError> {
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    return err({
      type: "invalid_order_item",
      message: `Order item quantity for product ${input.productId} must be a positive integer`,
    });
  }

  return ok({
    productId: input.productId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    lineTotal: multiplyMoney(input.unitPrice, input.quantity),
  });
}

export function orderItemFromCartItem(
  item: CartItem,
): Result<OrderItem, OrderDomainError> {
  return createOrderItem({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  });
}
