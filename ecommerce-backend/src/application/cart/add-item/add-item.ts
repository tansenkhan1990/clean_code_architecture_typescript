import {
  addItem as addItemToCart,
  createCart,
  type Cart,
} from "../../../domain/cart/cart.js";
import {
  checkAvailability,
  type InventoryItem,
} from "../../../domain/inventory/inventory-item.js";
import type { Product } from "../../../domain/product/product.js";
import { err, ok } from "../../../domain/shared/result.js";
import type { AddItem, AddItemDependencies } from "./add-item.types.js";

/**
 * Adding to a cart never touches stock: it only checks that the units could be
 * promised. Stock moves when an order is placed, which keeps carts disposable.
 */
export function addItemUseCase({
  carts,
  products,
  inventory,
  ids,
  clock,
}: AddItemDependencies): AddItem {
  return async (input) => {
    const now = clock.now();

    let product: Product | null;

    try {
      product = await products.findById(input.productId);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load product",
      });
    }

    if (product === null) {
      return err({
        type: "product_not_found",
        message: `Product ${input.productId} was not found`,
      });
    }

    let stock: InventoryItem | null;

    try {
      stock = await inventory.findByProductId(input.productId);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load stock",
      });
    }

    if (stock === null) {
      return err({
        type: "inventory_not_found",
        message: `No stock record exists for product ${input.productId}`,
      });
    }

    // A cart is a promise, not a reservation: this asks the inventory rule
    // whether the units could be promised and mutates nothing.
    const availability = checkAvailability(stock, input.quantity);

    if (!availability.ok) {
      return availability.error.type === "insufficient_stock"
        ? err({
            type: "insufficient_stock",
            message: availability.error.message,
          })
        : err({
            type: "invalid_cart_quantity",
            message: availability.error.message,
          });
    }

    let cart: Cart | null;

    try {
      cart = await carts.findByCustomerId(input.customerId);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not load cart",
      });
    }

    const current =
      cart ??
      createCart({
        id: ids.nextId(),
        customerId: input.customerId,
        createdAt: now,
      });

    const updated = addItemToCart(current, {
      productId: product.id,
      quantity: input.quantity,
      unitPrice: product.price,
      addedAt: now,
    });

    if (!updated.ok) {
      return updated.error.type === "cart_currency_mismatch"
        ? err({
            type: "cart_currency_mismatch",
            message: updated.error.message,
          })
        : err({
            type: "invalid_cart_quantity",
            message: updated.error.message,
          });
    }

    try {
      await carts.save(updated.value);
    } catch {
      return err({
        type: "repository_error",
        message: "Could not save cart",
      });
    }

    return ok(updated.value);
  };
}
