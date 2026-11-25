import type { DomainEvent } from "../shared/domain-event.js";
import type { Order } from "./order.js";

export type OrderCreated = DomainEvent<
  "order.created",
  {
    orderId: string;
    customerId: string;
    totalInMinorUnits: number;
    currency: string;
  }
>;

export type OrderPaid = DomainEvent<
  "order.paid",
  { orderId: string; customerId: string; providerReference: string }
>;

export type OrderCancelled = DomainEvent<
  "order.cancelled",
  { orderId: string; customerId: string }
>;

export function orderCreated(order: Order, occurredAt: string): OrderCreated {
  return {
    name: "order.created",
    occurredAt,
    payload: {
      orderId: order.id,
      customerId: order.customerId,
      totalInMinorUnits: order.total.amountInMinorUnits,
      currency: order.total.currency,
    },
  };
}

export function orderPaid(
  order: Order,
  providerReference: string,
  occurredAt: string,
): OrderPaid {
  return {
    name: "order.paid",
    occurredAt,
    payload: {
      orderId: order.id,
      customerId: order.customerId,
      providerReference,
    },
  };
}

export function orderCancelled(
  order: Order,
  occurredAt: string,
): OrderCancelled {
  return {
    name: "order.cancelled",
    occurredAt,
    payload: { orderId: order.id, customerId: order.customerId },
  };
}
