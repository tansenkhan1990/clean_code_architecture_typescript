import { describe, expect, it } from "vitest";
import type { DomainEvent } from "../../../src/domain/shared/domain-event.js";
import {
  DEFAULT_TOPIC,
  partitionKeyForEvent,
  toKafkaMessage,
  topicForEvent,
} from "../../../src/infrastructure/kafka/kafka-messages.js";

const orderEvent: DomainEvent = {
  name: "order.paid",
  occurredAt: "2026-01-01T00:00:00.000Z",
  payload: {
    orderId: "order-1",
    customerId: "customer-1",
    providerReference: "test_1",
  },
};

describe("kafka message mapping", () => {
  it("routes known events to their topic", () => {
    expect(topicForEvent("order.created")).toBe("ecommerce.orders.v1");
    expect(topicForEvent("order.paid")).toBe("ecommerce.orders.v1");
    expect(topicForEvent("order.cancelled")).toBe("ecommerce.orders.v1");
    expect(topicForEvent("customer.registered")).toBe("ecommerce.customers.v1");
  });

  it("falls back to the catch-all topic for unknown events", () => {
    expect(topicForEvent("something.new")).toBe(DEFAULT_TOPIC);
  });

  it("partitions by order id, then customer id", () => {
    expect(partitionKeyForEvent(orderEvent)).toBe("order-1");
    expect(
      partitionKeyForEvent({
        name: "customer.registered",
        occurredAt: "now",
        payload: { customerId: "customer-1" },
      }),
    ).toBe("customer-1");
    expect(
      partitionKeyForEvent({ name: "odd", occurredAt: "now", payload: {} }),
    ).toBeNull();
  });

  it("carries the outbox id as body id and header, for consumer dedupe", () => {
    const message = toKafkaMessage(orderEvent, { id: "outbox-1" });

    expect(message).toMatchObject({
      topic: "ecommerce.orders.v1",
      key: "order-1",
      headers: {
        "x-event-id": "outbox-1",
        "x-event-name": "order.paid",
        "x-event-version": "1",
      },
    });
    expect(JSON.parse(message.value)).toMatchObject({
      id: "outbox-1",
      name: "order.paid",
      payload: { orderId: "order-1" },
    });
  });

  it("never leaks a topic name into the event body", () => {
    const message = toKafkaMessage(orderEvent, { id: "outbox-1" });

    expect(JSON.parse(message.value)).not.toHaveProperty("topic");
  });
});
