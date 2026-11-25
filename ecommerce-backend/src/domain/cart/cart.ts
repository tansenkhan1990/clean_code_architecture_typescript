import type { CustomerId } from "../customer/customer-id.js";
import type { Money } from "../product/money.js";
import type { ProductId } from "../product/product-id.js";
import { ok, type Result } from "../shared/result.js";
import {
  cartItemTotal,
  createCartItem,
  MAX_ITEM_QUANTITY,
  type CartItem,
} from "./cart-item.js";
import type { CartDomainError } from "./cart-errors.js";

export type CartId = string;

/** One open cart per customer, holding priced lines and nothing else. */
export type Cart = {
  id: CartId;
  customerId: CustomerId;
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
};

export function createCart(input: {
  id: CartId;
  customerId: CustomerId;
  createdAt: string;
}): Cart {
  return {
    id: input.id,
    customerId: input.customerId,
    items: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

/**
 * Adds a line, merging into an existing line for the same product. All lines
 * must share one currency, otherwise the cart total would be undefined.
 */
export function addItem(
  cart: Cart,
  input: {
    productId: ProductId;
    quantity: number;
    unitPrice: Money;
    addedAt: string;
  },
): Result<Cart, CartDomainError> {
  const candidate = createCartItem({
    productId: input.productId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
  });

  if (!candidate.ok) {
    return candidate;
  }

  const cartCurrency = cart.items[0]?.unitPrice.currency;

  if (cartCurrency !== undefined && cartCurrency !== input.unitPrice.currency) {
    return {
      ok: false,
      error: {
        type: "cart_currency_mismatch",
        message: `This cart is priced in ${cartCurrency}`,
      },
    };
  }

  const existing = cart.items.find(
    (item) => item.productId === input.productId,
  );

  if (existing === undefined) {
    return ok({
      ...cart,
      items: [...cart.items, candidate.value],
      updatedAt: input.addedAt,
    });
  }

  const quantity = existing.quantity + candidate.value.quantity;

  if (quantity > MAX_ITEM_QUANTITY) {
    return {
      ok: false,
      error: {
        type: "invalid_cart_quantity",
        message: `A cart line cannot exceed ${MAX_ITEM_QUANTITY} units`,
      },
    };
  }

  return ok({
    ...cart,
    items: cart.items.map((item) =>
      item.productId === input.productId
        ? { ...item, quantity, unitPrice: input.unitPrice }
        : item,
    ),
    updatedAt: input.addedAt,
  });
}

export function removeItem(
  cart: Cart,
  productId: ProductId,
  removedAt: string,
): Result<Cart, CartDomainError> {
  const exists = cart.items.some((item) => item.productId === productId);

  if (!exists) {
    return {
      ok: false,
      error: {
        type: "item_not_in_cart",
        message: `Product ${productId} is not in this cart`,
      },
    };
  }

  return ok({
    ...cart,
    items: cart.items.filter((item) => item.productId !== productId),
    updatedAt: removedAt,
  });
}

export function clearCart(cart: Cart, clearedAt: string): Cart {
  return { ...cart, items: [], updatedAt: clearedAt };
}

/** Total of a cart, or `null` when it is empty (so no currency is implied). */
export function cartTotal(cart: Cart): Money | null {
  const first = cart.items[0];

  if (first === undefined) {
    return null;
  }

  return cart.items.reduce<Money>(
    (total, item) => ({
      amountInMinorUnits:
        total.amountInMinorUnits + cartItemTotal(item).amountInMinorUnits,
      currency: total.currency,
    }),
    { amountInMinorUnits: 0, currency: first.unitPrice.currency },
  );
}

export function cartItemCount(cart: Cart): number {
  return cart.items.reduce((count, item) => count + item.quantity, 0);
}
