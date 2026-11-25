import type { CustomerId } from "../customer/customer-id.js";
import { addMoney, type Money } from "../product/money.js";
import { err, ok, type Result } from "../shared/result.js";
import type { OrderDomainError, OrderTransitionError } from "./order-errors.js";
import type { OrderItem } from "./order-item.js";
import type { OrderStatus } from "./order-status.js";

export type OrderId = string;

export type Order = {
  id: OrderId;
  customerId: CustomerId;
  items: OrderItem[];
  total: Money;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
};

/**
 * The total is always derived from the lines. Accepting a total from the
 * caller would allow an order whose price does not match its contents.
 */
function sumOrderItems(items: OrderItem[]): Result<Money, OrderDomainError> {
  const first = items[0];

  if (first === undefined) {
    return err({
      type: "empty_order",
      message: "An order must contain at least one item",
    });
  }

  let total: Money = {
    amountInMinorUnits: 0,
    currency: first.unitPrice.currency,
  };

  for (const item of items) {
    const sum = addMoney(total, item.lineTotal);

    if (!sum.ok) {
      return err({
        type: "invalid_order_item",
        message: sum.error.message,
      });
    }

    total = sum.value;
  }

  return ok(total);
}

export function createOrder(input: {
  id: OrderId;
  customerId: CustomerId;
  items: OrderItem[];
  createdAt: string;
}): Result<Order, OrderDomainError> {
  const total = sumOrderItems(input.items);

  if (!total.ok) {
    return total;
  }

  return ok({
    id: input.id,
    customerId: input.customerId,
    items: input.items,
    total: total.value,
    status: "pending_payment",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    paidAt: null,
    cancelledAt: null,
  });
}

export function payOrder(
  order: Order,
  paidAt: string,
): Result<Order, OrderTransitionError> {
  if (order.status === "paid") {
    return err({
      type: "order_already_paid",
      message: "Order has already been paid",
    });
  }

  if (order.status === "cancelled") {
    return err({
      type: "order_cancelled",
      message: "A cancelled order cannot be paid",
    });
  }

  return ok({
    ...order,
    status: "paid",
    paidAt,
    updatedAt: paidAt,
  });
}

export function cancelOrder(
  order: Order,
  cancelledAt: string,
): Result<Order, OrderTransitionError> {
  if (order.status === "paid") {
    return err({
      type: "order_already_paid",
      message: "A paid order cannot be cancelled",
    });
  }

  if (order.status === "cancelled") {
    return err({
      type: "order_cancelled",
      message: "Order has already been cancelled",
    });
  }

  return ok({
    ...order,
    status: "cancelled",
    cancelledAt,
    updatedAt: cancelledAt,
  });
}
