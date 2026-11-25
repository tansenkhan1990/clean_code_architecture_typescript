import { describe, expect, it } from "vitest";
import {
  cancelOrder,
  createOrder,
  payOrder,
} from "../../../src/domain/order/order.js";
import { createOrderItem } from "../../../src/domain/order/order-item.js";
import { createMoney } from "../../../src/domain/product/money.js";

const at = "2026-01-01T00:00:00.000Z";

function usd(amountInMinorUnits: number) {
  const money = createMoney(amountInMinorUnits, "usd");

  if (!money.ok) {
    throw new Error("Expected valid money");
  }

  return money.value;
}

function item(productId: string, quantity: number, unitPrice: number) {
  const created = createOrderItem({
    productId,
    quantity,
    unitPrice: usd(unitPrice),
  });

  if (!created.ok) {
    throw new Error("Expected an order item");
  }

  return created.value;
}

function pendingOrder() {
  const order = createOrder({
    id: "order-1",
    customerId: "customer-1",
    items: [item("p1", 2, 1000), item("p2", 1, 500)],
    createdAt: at,
  });

  if (!order.ok) {
    throw new Error("Expected an order");
  }

  return order.value;
}

describe("order", () => {
  it("derives its total from the lines", () => {
    expect(pendingOrder().total).toEqual({
      amountInMinorUnits: 2500,
      currency: "USD",
    });
  });

  it("starts pending payment", () => {
    expect(pendingOrder().status).toBe("pending_payment");
  });

  it("rejects an order without lines", () => {
    const order = createOrder({
      id: "order-1",
      customerId: "customer-1",
      items: [],
      createdAt: at,
    });

    expect(order.ok).toBe(false);
    if (order.ok) throw new Error("Expected a failure");

    expect(order.error.type).toBe("empty_order");
  });

  it("marks an order paid exactly once", () => {
    const paid = payOrder(pendingOrder(), at);
    if (!paid.ok) throw new Error("Expected a paid order");

    expect(paid.value.status).toBe("paid");
    expect(paid.value.paidAt).toBe(at);

    const again = payOrder(paid.value, at);

    expect(again.ok).toBe(false);
    if (again.ok) throw new Error("Expected a failure");

    expect(again.error.type).toBe("order_already_paid");
  });

  it("cancels a pending order and refuses to cancel a paid one", () => {
    const cancelled = cancelOrder(pendingOrder(), at);
    if (!cancelled.ok) throw new Error("Expected a cancelled order");

    expect(cancelled.value.status).toBe("cancelled");

    const paid = payOrder(pendingOrder(), at);
    if (!paid.ok) throw new Error("Expected a paid order");

    const result = cancelOrder(paid.value, at);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");

    expect(result.error.type).toBe("order_already_paid");
  });
});
