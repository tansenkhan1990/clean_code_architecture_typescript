import type { DomainEvent } from "../../domain/shared/domain-event.js";

/**
 * Topic names and partition keys belong to the broker world. Keeping the
 * mapping in one pure module means the application never learns a topic name,
 * and the routing is testable without a broker.
 */
export const ORDER_TOPIC = "ecommerce.orders.v1";
export const CUSTOMER_TOPIC = "ecommerce.customers.v1";

export const DEFAULT_TOPIC = "ecommerce.events.v1";

const TOPICS: Record<string, string> = {
  "customer.registered": CUSTOMER_TOPIC,
  "order.created": ORDER_TOPIC,
  "order.paid": ORDER_TOPIC,
  "order.cancelled": ORDER_TOPIC,
};

/** Declared once, created at start-up, so a consumer never races a topic. */
export const KAFKA_TOPICS = [ORDER_TOPIC, CUSTOMER_TOPIC, DEFAULT_TOPIC];

export type KafkaMessage = {
  topic: string;
  key: string | null;
  value: string;
  headers: Record<string, string>;
};

export function topicForEvent(name: string): string {
  return TOPICS[name] ?? DEFAULT_TOPIC;
}

/**
 * Orders are partitioned by order id, so all events for one order land on the
 * same partition and reach a consumer in order. Customer events fall back to
 * the customer id for the same reason.
 */
export function partitionKeyForEvent(event: DomainEvent): string | null {
  const candidate = event.payload["orderId"] ?? event.payload["customerId"];

  return typeof candidate === "string" ? candidate : null;
}

export function toKafkaMessage(
  event: DomainEvent,
  envelope: { id: string },
): KafkaMessage {
  return {
    topic: topicForEvent(event.name),
    key: partitionKeyForEvent(event),
    value: JSON.stringify({
      id: envelope.id,
      name: event.name,
      occurredAt: event.occurredAt,
      payload: event.payload,
    }),
    headers: {
      "x-event-id": envelope.id,
      "x-event-name": event.name,
      "x-event-version": "1",
    },
  };
}
