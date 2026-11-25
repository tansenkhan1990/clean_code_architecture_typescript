import { describe, expect, it } from "vitest";
import {
  checkAvailability,
  createInventoryItem,
  reserveStock,
} from "../../../src/domain/inventory/inventory-item.js";

function stock(quantity: number) {
  const item = createInventoryItem({
    id: "inv-1",
    productId: "prod-1",
    quantity,
    updatedAt: "2026-01-01T00:00:00.000Z",
  });

  if (!item.ok) throw new Error("Expected stock");
  return item.value;
}

describe("checkAvailability", () => {
  it("accepts a request the free stock can cover", () => {
    expect(checkAvailability(stock(3), 3)).toEqual({ ok: true, value: true });
  });

  it("rejects a request above the free stock", () => {
    const result = checkAvailability(stock(1), 2);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");
    expect(result.error.type).toBe("insufficient_stock");
  });

  it("rejects a nonsensical quantity", () => {
    const result = checkAvailability(stock(5), 0);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");
    expect(result.error.type).toBe("invalid_quantity");
  });

  it("never mutates the item, unlike a reservation", () => {
    const item = stock(5);

    checkAvailability(item, 4);

    expect(item).toMatchObject({ available: 5, reserved: 0 });

    const reserved = reserveStock(item, 4, "2026-01-02T00:00:00.000Z");
    expect(reserved.ok).toBe(true);
    if (!reserved.ok) throw new Error("Expected a reservation");
    expect(reserved.value).toMatchObject({ available: 1, reserved: 4 });
    expect(item).toMatchObject({ available: 5, reserved: 0 });
  });

  it("is the single rule reserveStock applies", () => {
    const result = reserveStock(stock(1), 2, "2026-01-02T00:00:00.000Z");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");
    expect(result.error).toEqual({
      type: "insufficient_stock",
      message: "Only 1 unit(s) of product prod-1 are available",
    });
  });
});
