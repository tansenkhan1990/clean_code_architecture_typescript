import type { Prisma } from "@prisma/client";
import type { OutboxMessage } from "../../../application/ports/outbox.js";
import type { Account } from "../../../domain/auth/account.js";
import { isRole } from "../../../domain/auth/role.js";
import type { Cart as CartAggregate } from "../../../domain/cart/cart.js";
import type { CartItem } from "../../../domain/cart/cart-item.js";
import type { Customer } from "../../../domain/customer/customer.js";
import type { InventoryItem } from "../../../domain/inventory/inventory-item.js";
import type { Order } from "../../../domain/order/order.js";
import type { OrderItem } from "../../../domain/order/order-item.js";
import type { OrderStatus } from "../../../domain/order/order-status.js";
import type { Product } from "../../../domain/product/product.js";

/**
 * The database stores timestamps as `timestamptz` and line items as JSON
 * snapshots. The domain speaks ISO strings and typed arrays. This module is the
 * only place that translates, so neither side borrows the other's shape.
 */
export function toIso(value: Date): string {
  return value.toISOString();
}

export function toDate(value: string): Date {
  return new Date(value);
}

export type CustomerRow = {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
};

export function fromCustomerRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: toIso(row.createdAt),
  };
}

export function toCustomerRow(customer: Customer) {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    createdAt: toDate(customer.createdAt),
  };
}

export type AccountRow = {
  customerId: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
};

export function fromAccountRow(row: AccountRow): Account {
  return {
    customerId: row.customerId,
    passwordHash: row.passwordHash,
    // An unreadable role is downgraded, never guessed upward: a corrupted row
    // must not become an administrator.
    role: isRole(row.role) ? row.role : "customer",
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function toAccountRow(account: Account) {
  return {
    customerId: account.customerId,
    passwordHash: account.passwordHash,
    role: account.role,
    createdAt: toDate(account.createdAt),
    updatedAt: toDate(account.updatedAt),
  };
}

export type ProductRow = {
  id: string;
  name: string;
  amountInMinorUnits: number;
  currency: string;
  createdAt: Date;
};

export function fromProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    price: {
      amountInMinorUnits: row.amountInMinorUnits,
      currency: row.currency,
    },
    createdAt: toIso(row.createdAt),
  };
}

export function toProductRow(product: Product) {
  return {
    id: product.id,
    name: product.name,
    amountInMinorUnits: product.price.amountInMinorUnits,
    currency: product.price.currency,
    createdAt: toDate(product.createdAt),
  };
}

export type InventoryRow = {
  id: string;
  productId: string;
  available: number;
  reserved: number;
  updatedAt: Date;
};

export function fromInventoryRow(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    productId: row.productId,
    available: row.available,
    reserved: row.reserved,
    updatedAt: toIso(row.updatedAt),
  };
}

export function toInventoryRow(item: InventoryItem) {
  return {
    id: item.id,
    productId: item.productId,
    available: item.available,
    reserved: item.reserved,
    updatedAt: toDate(item.updatedAt),
  };
}

export type CartRow = {
  id: string;
  customerId: string;
  items: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

export function fromCartRow(row: CartRow): CartAggregate {
  return {
    id: row.id,
    customerId: row.customerId,
    items: row.items as unknown as CartItem[],
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function toCartRow(cart: CartAggregate) {
  return {
    id: cart.id,
    customerId: cart.customerId,
    items: cart.items as unknown as Prisma.InputJsonValue,
    createdAt: toDate(cart.createdAt),
    updatedAt: toDate(cart.updatedAt),
  };
}

export type OrderRow = {
  id: string;
  customerId: string;
  items: Prisma.JsonValue;
  totalAmountInMinor: number;
  currency: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  cancelledAt: Date | null;
};

export function fromOrderRow(row: OrderRow): Order {
  return {
    id: row.id,
    customerId: row.customerId,
    items: row.items as unknown as OrderItem[],
    total: {
      amountInMinorUnits: row.totalAmountInMinor,
      currency: row.currency,
    },
    status: row.status as OrderStatus,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    paidAt: row.paidAt === null ? null : toIso(row.paidAt),
    cancelledAt: row.cancelledAt === null ? null : toIso(row.cancelledAt),
  };
}

export function toOrderRow(order: Order) {
  return {
    id: order.id,
    customerId: order.customerId,
    items: order.items as unknown as Prisma.InputJsonValue,
    totalAmountInMinor: order.total.amountInMinorUnits,
    currency: order.total.currency,
    status: order.status,
    createdAt: toDate(order.createdAt),
    updatedAt: toDate(order.updatedAt),
    paidAt: order.paidAt === null ? null : toDate(order.paidAt),
    cancelledAt: order.cancelledAt === null ? null : toDate(order.cancelledAt),
  };
}

export type OutboxRow = {
  id: string;
  eventName: string;
  occurredAt: Date;
  payload: Prisma.JsonValue;
  createdAt: Date;
  publishedAt: Date | null;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
  deadLetteredAt: Date | null;
};

export function fromOutboxRow(row: OutboxRow): OutboxMessage {
  return {
    id: row.id,
    event: {
      name: row.eventName,
      occurredAt: toIso(row.occurredAt),
      payload: row.payload as Record<string, unknown>,
    },
    createdAt: toIso(row.createdAt),
    publishedAt: row.publishedAt === null ? null : toIso(row.publishedAt),
    attempts: row.attempts,
    lastError: row.lastError,
    nextAttemptAt: toIso(row.nextAttemptAt),
    deadLetteredAt:
      row.deadLetteredAt === null ? null : toIso(row.deadLetteredAt),
  };
}

export function toOutboxRow(message: OutboxMessage) {
  return {
    id: message.id,
    eventName: message.event.name,
    occurredAt: toDate(message.event.occurredAt),
    payload: message.event.payload as unknown as Prisma.InputJsonValue,
    createdAt: toDate(message.createdAt),
    publishedAt:
      message.publishedAt === null ? null : toDate(message.publishedAt),
    attempts: message.attempts,
    lastError: message.lastError,
    nextAttemptAt: toDate(message.nextAttemptAt),
    deadLetteredAt:
      message.deadLetteredAt === null ? null : toDate(message.deadLetteredAt),
  };
}
