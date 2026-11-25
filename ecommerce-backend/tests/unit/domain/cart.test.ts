import { describe, expect, it } from "vitest";
import {
  addItem,
  cartItemCount,
  cartTotal,
  createCart,
  removeItem,
} from "../../../src/domain/cart/cart.js";
import { MAX_ITEM_QUANTITY } from "../../../src/domain/cart/cart-item.js";
import { createMoney } from "../../../src/domain/product/money.js";

const addedAt = "2026-01-01T00:00:00.000Z";

function usd(amountInMinorUnits: number) {
  const money = createMoney(amountInMinorUnits, "usd");

  if (!money.ok) {
    throw new Error("Expected valid money");
  }

  return money.value;
}

function emptyCart() {
  return createCart({
    id: "cart-1",
    customerId: "customer-1",
    createdAt: addedAt,
  });
}

describe("cart", () => {
  it("adds a line and derives the total from the lines", () => {
    const cart = addItem(emptyCart(), {
      productId: "p1",
      quantity: 2,
      unitPrice: usd(1999),
      addedAt,
    });

    expect(cart.ok).toBe(true);
    if (!cart.ok) throw new Error("Expected a cart");

    expect(cartItemCount(cart.value)).toBe(2);
    expect(cartTotal(cart.value)).toEqual({
      amountInMinorUnits: 3998,
      currency: "USD",
    });
  });

  it("merges a repeated product instead of adding a second line", () => {
    const first = addItem(emptyCart(), {
      productId: "p1",
      quantity: 1,
      unitPrice: usd(500),
      addedAt,
    });

    if (!first.ok) throw new Error("Expected a cart");

    const second = addItem(first.value, {
      productId: "p1",
      quantity: 2,
      unitPrice: usd(500),
      addedAt,
    });

    if (!second.ok) throw new Error("Expected a cart");

    expect(second.value.items).toHaveLength(1);
    expect(second.value.items[0]?.quantity).toBe(3);
  });

  it("rejects a quantity above the per-line limit", () => {
    const result = addItem(emptyCart(), {
      productId: "p1",
      quantity: MAX_ITEM_QUANTITY + 1,
      unitPrice: usd(100),
      addedAt,
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected a failure");

    expect(result.error.type).toBe("invalid_cart_quantity");
  });

  it("rejects a second currency in the same cart", () => {
    const first = addItem(emptyCart(), {
      productId: "p1",
      quantity: 1,
      unitPrice: usd(100),
      addedAt,
    });

    if (!first.ok) throw new Error("Expected a cart");

    const euros = createMoney(100, "eur");
    if (!euros.ok) throw new Error("Expected valid money");

    const second = addItem(first.value, {
      productId: "p2",
      quantity: 1,
      unitPrice: euros.value,
      addedAt,
    });

    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("Expected a failure");

    expect(second.error.type).toBe("cart_currency_mismatch");
  });

  it("removes a line and refuses to remove a missing one", () => {
    const added = addItem(emptyCart(), {
      productId: "p1",
      quantity: 1,
      unitPrice: usd(100),
      addedAt,
    });

    if (!added.ok) throw new Error("Expected a cart");

    const removed = removeItem(added.value, "p1", addedAt);
    if (!removed.ok) throw new Error("Expected a cart");

    expect(removed.value.items).toHaveLength(0);

    const missing = removeItem(removed.value, "p1", addedAt);

    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error("Expected a failure");

    expect(missing.error.type).toBe("item_not_in_cart");
  });

  it("has no total while empty", () => {
    expect(cartTotal(emptyCart())).toBeNull();
  });
});
