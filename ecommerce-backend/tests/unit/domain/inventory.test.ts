import { describe, expect, it } from "vitest";
import {
  commitReservation,
  createInventoryItem,
  releaseStock,
  reserveStock,
} from "../../../src/domain/inventory/inventory-item.js";

const at = "2026-01-01T00:00:00.000Z";

function stockOf(quantity: number) {
  const item = createInventoryItem({
    id: "inventory-1",
    productId: "p1",
    quantity,
    updatedAt: at,
  });

  if (!item.ok) {
    throw new Error("Expected an inventory item");
  }

  return item.value;
}

describe("inventory", () => {
  it("moves units from available to reserved when stock is held", () => {
    const reserved = reserveStock(stockOf(3), 2, at);

    expect(reserved.ok).toBe(true);
    if (!reserved.ok) throw new Error("Expected a reservation");

    expect(reserved.value.available).toBe(1);
    expect(reserved.value.reserved).toBe(2);
  });

  it("refuses to reserve more than is available", () => {
    const reserved = reserveStock(stockOf(1), 2, at);

    expect(reserved.ok).toBe(false);
    if (reserved.ok) throw new Error("Expected a failure");

    expect(reserved.error.type).toBe("insufficient_stock");
  });

  it("returns held units to the free pool on release", () => {
    const reserved = reserveStock(stockOf(3), 2, at);
    if (!reserved.ok) throw new Error("Expected a reservation");

    const released = releaseStock(reserved.value, 2, at);
    if (!released.ok) throw new Error("Expected a release");

    expect(released.value.available).toBe(3);
    expect(released.value.reserved).toBe(0);
  });

  it("consumes held units on commit without freeing them", () => {
    const reserved = reserveStock(stockOf(3), 2, at);
    if (!reserved.ok) throw new Error("Expected a reservation");

    const committed = commitReservation(reserved.value, 2, at);
    if (!committed.ok) throw new Error("Expected a commit");

    expect(committed.value.available).toBe(1);
    expect(committed.value.reserved).toBe(0);
  });

  it("rejects a non-integer quantity", () => {
    const result = reserveStock(stockOf(3), 1.5, at);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");

    expect(result.error.type).toBe("invalid_quantity");
  });
});
