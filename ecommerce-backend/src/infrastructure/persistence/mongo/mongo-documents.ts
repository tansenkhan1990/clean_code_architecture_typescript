import type { DomainEvent } from "../../../domain/shared/domain-event.js";
import type { OutboxMessage } from "../../../application/ports/outbox.js";
import type { Cart } from "../../../domain/cart/cart.js";
import type { Customer } from "../../../domain/customer/customer.js";
import type { InventoryItem } from "../../../domain/inventory/inventory-item.js";
import type { Money } from "../../../domain/product/money.js";
import type { Order } from "../../../domain/order/order.js";
import type { OrderStatus } from "../../../domain/order/order-status.js";
import type { Product } from "../../../domain/product/product.js";

/**
 * MongoDB documents are a storage shape, not a domain shape.
 *
 * They happen to look similar today, which is exactly why the conversion lives
 * here: adding a field, renaming one, or moving to a nested `price` object must
 * never reach the domain. Driver types stop at this file's boundary too.
 */

export type CustomerDocument = {
  _id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type ProductDocument = {
  _id: string;
  name: string;
  price: Money;
  createdAt: string;
};

export type InventoryDocument = {
  _id: string;
  productId: string;
  available: number;
  reserved: number;
  updatedAt: string;
};

export type CartDocument = {
  _id: string;
  customerId: string;
  items: { productId: string; quantity: number; unitPrice: Money }[];
  createdAt: string;
  updatedAt: string;
};

export type OrderDocument = {
  _id: string;
  customerId: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: Money;
    lineTotal: Money;
  }[];
  total: Money;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
};

export type OutboxDocument = {
  _id: string;
  event: DomainEvent;
  createdAt: string;
  publishedAt: string | null;
  attempts: number;
  lastError: string | null;
};

function copyMoney(money: Money): Money {
  return {
    amountInMinorUnits: money.amountInMinorUnits,
    currency: money.currency,
  };
}

export function toCustomerDocument(customer: Customer): CustomerDocument {
  return {
    _id: customer.id,
    email: customer.email,
    name: customer.name,
    createdAt: customer.createdAt,
  };
}

export function fromCustomerDocument(doc: CustomerDocument): Customer {
  return {
    id: doc._id,
    email: doc.email,
    name: doc.name,
    createdAt: doc.createdAt,
  };
}

export function toProductDocument(product: Product): ProductDocument {
  return {
    _id: product.id,
    name: product.name,
    price: copyMoney(product.price),
    createdAt: product.createdAt,
  };
}

export function fromProductDocument(doc: ProductDocument): Product {
  return {
    id: doc._id,
    name: doc.name,
    price: copyMoney(doc.price),
    createdAt: doc.createdAt,
  };
}

export function toInventoryDocument(item: InventoryItem): InventoryDocument {
  return {
    _id: item.id,
    productId: item.productId,
    available: item.available,
    reserved: item.reserved,
    updatedAt: item.updatedAt,
  };
}

export function fromInventoryDocument(doc: InventoryDocument): InventoryItem {
  return {
    id: doc._id,
    productId: doc.productId,
    available: doc.available,
    reserved: doc.reserved,
    updatedAt: doc.updatedAt,
  };
}

export function toCartDocument(cart: Cart): CartDocument {
  return {
    _id: cart.id,
    customerId: cart.customerId,
    items: cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: copyMoney(item.unitPrice),
    })),
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
}

export function fromCartDocument(doc: CartDocument): Cart {
  return {
    id: doc._id,
    customerId: doc.customerId,
    items: doc.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: copyMoney(item.unitPrice),
    })),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function toOrderDocument(order: Order): OrderDocument {
  return {
    _id: order.id,
    customerId: order.customerId,
    items: order.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: copyMoney(item.unitPrice),
      lineTotal: copyMoney(item.lineTotal),
    })),
    total: copyMoney(order.total),
    status: order.status,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
  };
}

export function fromOrderDocument(doc: OrderDocument): Order {
  return {
    id: doc._id,
    customerId: doc.customerId,
    items: doc.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: copyMoney(item.unitPrice),
      lineTotal: copyMoney(item.lineTotal),
    })),
    total: copyMoney(doc.total),
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    paidAt: doc.paidAt,
    cancelledAt: doc.cancelledAt,
  };
}

export function toOutboxDocument(message: OutboxMessage): OutboxDocument {
  return {
    _id: message.id,
    event: {
      name: message.event.name,
      occurredAt: message.event.occurredAt,
      payload: message.event.payload,
    },
    createdAt: message.createdAt,
    publishedAt: message.publishedAt,
    attempts: message.attempts,
    lastError: message.lastError,
  };
}

export function fromOutboxDocument(doc: OutboxDocument): OutboxMessage {
  return {
    id: doc._id,
    event: {
      name: doc.event.name,
      occurredAt: doc.event.occurredAt,
      payload: doc.event.payload,
    },
    createdAt: doc.createdAt,
    publishedAt: doc.publishedAt,
    attempts: doc.attempts,
    lastError: doc.lastError,
  };
}
