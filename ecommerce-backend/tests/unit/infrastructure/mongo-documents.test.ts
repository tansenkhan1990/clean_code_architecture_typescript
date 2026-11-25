import { describe, expect, it } from "vitest";
import type { OutboxMessage } from "../../../src/application/ports/outbox.js";
import type { Customer } from "../../../src/domain/customer/customer.js";
import { createMoney } from "../../../src/domain/product/money.js";
import { createProduct } from "../../../src/domain/product/product.js";
import {
  fromCustomerDocument,
  fromOrderDocument,
  fromOutboxDocument,
  fromProductDocument,
  toCustomerDocument,
  toOrderDocument,
  toOutboxDocument,
  toProductDocument,
} from "../../../src/infrastructure/persistence/mongo/mongo-documents.js";
import { createOrder } from "../../../src/domain/order/order.js";
import { orderCreated } from "../../../src/domain/order/order-events.js";
import { createOrderItem } from "../../../src/domain/order/order-item.js";

const NOW = "2026-01-01T00:00:00.000Z";

const customer: Customer = {
  id: "customer-1",
  email: "ada@example.com",
  name: "Ada",
  createdAt: NOW,
};

describe("mongo documents", () => {
  it("round-trips a customer without losing the domain id", () => {
    const doc = toCustomerDocument(customer);

    expect(doc).toEqual({
      _id: "customer-1",
      email: "ada@example.com",
      name: "Ada",
      createdAt: NOW,
    });
    expect(fromCustomerDocument(doc)).toEqual(customer);
  });

  it("keeps money as integer minor units in the document", () => {
    const price = createMoney(1999, "usd");
    if (!price.ok) throw new Error("Expected money");

    const product = createProduct({
      id: "product-1",
      name: "Keyboard",
      price: price.value,
      createdAt: NOW,
    });
    if (!product.ok) throw new Error("Expected a product");

    const doc = toProductDocument(product.value);

    expect(doc.price).toEqual({ amountInMinorUnits: 1999, currency: "USD" });
    expect(fromProductDocument(doc)).toEqual(product.value);
  });

  it("round-trips an order with its status and snapshot prices", () => {
    const price = createMoney(1999, "usd");
    if (!price.ok) throw new Error("Expected money");

    const item = createOrderItem({
      productId: "product-1",
      quantity: 2,
      unitPrice: price.value,
    });
    if (!item.ok) throw new Error("Expected an item");

    const order = createOrder({
      id: "order-1",
      customerId: "customer-1",
      items: [item.value],
      createdAt: NOW,
    });
    if (!order.ok) throw new Error("Expected an order");

    expect(fromOrderDocument(toOrderDocument(order.value))).toEqual(
      order.value,
    );
  });

  it("round-trips an outbox message and its broker-agnostic event", () => {
    const message: OutboxMessage = {
      id: "message-1",
      event: orderCreated(
        {
          id: "order-1",
          customerId: "customer-1",
          items: [],
          total: { amountInMinorUnits: 3998, currency: "USD" },
          status: "pending_payment",
          createdAt: NOW,
          updatedAt: NOW,
          paidAt: null,
          cancelledAt: null,
        },
        NOW,
      ),
      createdAt: NOW,
      publishedAt: null,
      attempts: 0,
      lastError: null,
    };

    const doc = toOutboxDocument(message);

    expect(doc._id).toBe("message-1");
    expect(doc.event.name).toBe("order.created");
    expect(fromOutboxDocument(doc)).toEqual(message);
  });

  it("returns copies, so a caller cannot mutate stored money", () => {
    const doc = toCustomerDocument(customer);
    const restored = fromCustomerDocument(doc);

    restored.name = "Changed";

    expect(doc.name).toBe("Ada");
  });
});
