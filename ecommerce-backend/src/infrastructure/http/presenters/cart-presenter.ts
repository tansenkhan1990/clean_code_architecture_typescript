import {
  cartItemCount,
  cartTotal,
  type Cart,
} from "../../../domain/cart/cart.js";

export type CartItemResponse = {
  productId: string;
  quantity: number;
  unitPrice: {
    amountInMinorUnits: number;
    currency: string;
  };
};

export type CartResponse = {
  id: string;
  customerId: string;
  items: CartItemResponse[];
  itemCount: number;
  total: {
    amountInMinorUnits: number;
    currency: string;
  } | null;
  updatedAt: string;
};

/**
 * The cart response includes derived facts so clients never do arithmetic.
 * Deriving them with the domain functions keeps the definition of a cart total
 * in one place.
 */
export function toCartResponse(cart: Cart): CartResponse {
  return {
    id: cart.id,
    customerId: cart.customerId,
    items: cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: {
        amountInMinorUnits: item.unitPrice.amountInMinorUnits,
        currency: item.unitPrice.currency,
      },
    })),
    itemCount: cartItemCount(cart),
    total: cartTotal(cart),
    updatedAt: cart.updatedAt,
  };
}
