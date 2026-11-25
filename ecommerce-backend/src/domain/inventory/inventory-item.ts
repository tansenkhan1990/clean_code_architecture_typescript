import type { ProductId } from "../product/product-id.js";
import { err, ok, type Result } from "../shared/result.js";
import type { InventoryDomainError } from "./inventory-errors.js";
import type { InventoryId } from "./inventory-id.js";

/**
 * Stock is split into what is free to promise (`available`) and what is held
 * for an open order (`reserved`). The split is what makes a reservation
 * reversible without losing the fact that units exist.
 */
export type InventoryItem = {
  id: InventoryId;
  productId: ProductId;
  available: number;
  reserved: number;
  updatedAt: string;
};

function isValidQuantity(quantity: number, minimum: number): boolean {
  return Number.isInteger(quantity) && quantity >= minimum;
}

export function createInventoryItem(input: {
  id: InventoryId;
  productId: ProductId;
  quantity: number;
  updatedAt: string;
}): Result<InventoryItem, InventoryDomainError> {
  if (!isValidQuantity(input.quantity, 0)) {
    return err({
      type: "invalid_quantity",
      message: "Initial quantity must be a non-negative integer",
    });
  }

  return ok({
    id: input.id,
    productId: input.productId,
    available: input.quantity,
    reserved: 0,
    updatedAt: input.updatedAt,
  });
}

/**
 * Answers "could these units be promised?" without changing anything.
 *
 * A check and a reservation are different operations: reading stock to price a
 * cart is not a mutation, so it must not look like one. `reserveStock` uses
 * this function, which keeps the definition of "enough" in exactly one place.
 */
export function checkAvailability(
  item: InventoryItem,
  quantity: number,
): Result<true, InventoryDomainError> {
  if (!isValidQuantity(quantity, 1)) {
    return err({
      type: "invalid_quantity",
      message: "Requested quantity must be a positive integer",
    });
  }

  if (item.available < quantity) {
    return err({
      type: "insufficient_stock",
      message: `Only ${item.available} unit(s) of product ${item.productId} are available`,
    });
  }

  return ok(true);
}

/** Holds units for an order. Fails when not enough stock is free. */
export function reserveStock(
  item: InventoryItem,
  quantity: number,
  reservedAt: string,
): Result<InventoryItem, InventoryDomainError> {
  const availability = checkAvailability(item, quantity);

  if (!availability.ok) {
    return err({
      type: availability.error.type,
      message: availability.error.message.replace(
        "Requested quantity",
        "Reserved quantity",
      ),
    });
  }

  return ok({
    ...item,
    available: item.available - quantity,
    reserved: item.reserved + quantity,
    updatedAt: reservedAt,
  });
}

/** Returns held units to the free pool, used when an order is cancelled. */
export function releaseStock(
  item: InventoryItem,
  quantity: number,
  releasedAt: string,
): Result<InventoryItem, InventoryDomainError> {
  if (!isValidQuantity(quantity, 1)) {
    return err({
      type: "invalid_quantity",
      message: "Released quantity must be a positive integer",
    });
  }

  if (item.reserved < quantity) {
    return err({
      type: "invalid_quantity",
      message: "Cannot release more units than are reserved",
    });
  }

  return ok({
    ...item,
    available: item.available + quantity,
    reserved: item.reserved - quantity,
    updatedAt: releasedAt,
  });
}

/** Consumes held units for good, used once payment has succeeded. */
export function commitReservation(
  item: InventoryItem,
  quantity: number,
  committedAt: string,
): Result<InventoryItem, InventoryDomainError> {
  if (!isValidQuantity(quantity, 1)) {
    return err({
      type: "invalid_quantity",
      message: "Committed quantity must be a positive integer",
    });
  }

  if (item.reserved < quantity) {
    return err({
      type: "invalid_quantity",
      message: "Cannot commit more units than are reserved",
    });
  }

  return ok({
    ...item,
    reserved: item.reserved - quantity,
    updatedAt: committedAt,
  });
}

/** Adds newly delivered units to the free pool. */
export function restock(
  item: InventoryItem,
  quantity: number,
  restockedAt: string,
): Result<InventoryItem, InventoryDomainError> {
  if (!isValidQuantity(quantity, 1)) {
    return err({
      type: "invalid_quantity",
      message: "Restocked quantity must be a positive integer",
    });
  }

  return ok({
    ...item,
    available: item.available + quantity,
    updatedAt: restockedAt,
  });
}
