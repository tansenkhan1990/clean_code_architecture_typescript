import { clearCart, type Cart } from "../../../domain/cart/cart.js";
import {
  reserveStock,
  type InventoryItem,
} from "../../../domain/inventory/inventory-item.js";
import { createOrder, type Order } from "../../../domain/order/order.js";
import { orderCreated } from "../../../domain/order/order-events.js";
import {
  orderItemFromCartItem,
  type OrderItem,
} from "../../../domain/order/order-item.js";
import { err, ok } from "../../../domain/shared/result.js";
import { stageEvent } from "../../outbox/stage-event.js";
import type {
  CreateOrder,
  CreateOrderDependencies,
  CreateOrderError,
} from "./create-order.types.js";

/**
 * Places an order inside one transaction: price snapshot, stock reservation,
 * the order itself, the emptied cart, and the `order.created` outbox row all
 * commit together or not at all.
 *
 * Nothing here publishes to a broker. If the write commits and the broker is
 * down, the outbox still holds the event, and the dispatcher retries it.
 */
export function createOrderUseCase({
  carts,
  orders,
  inventory,
  ids,
  clock,
  outbox,
  unitOfWork,
}: CreateOrderDependencies): CreateOrder {
  return async (input) =>
    unitOfWork.execute<Order, CreateOrderError>(async () => {
      const now = clock.now();

      const cart: Cart | null = await carts.findByCustomerId(input.customerId);

      if (cart === null) {
        return err({
          type: "cart_not_found",
          message: `No cart exists for customer ${input.customerId}`,
        });
      }

      if (cart.items.length === 0) {
        return err({
          type: "empty_cart",
          message: "Cart is empty",
        });
      }

      const items: OrderItem[] = [];

      for (const cartItem of cart.items) {
        const item = orderItemFromCartItem(cartItem);

        if (!item.ok) {
          return err({
            type: "invalid_order",
            message: item.error.message,
          });
        }

        items.push(item.value);
      }

      const order = createOrder({
        id: ids.nextId(),
        customerId: input.customerId,
        items,
        createdAt: now,
      });

      if (!order.ok) {
        return err({
          type: "invalid_order",
          message: order.error.message,
        });
      }

      const reservations: InventoryItem[] = [];

      for (const item of order.value.items) {
        const stock: InventoryItem | null = await inventory.findByProductId(
          item.productId,
        );

        if (stock === null) {
          return err({
            type: "inventory_not_found",
            message: `No stock record exists for product ${item.productId}`,
          });
        }

        const reserved = reserveStock(stock, item.quantity, now);

        if (!reserved.ok) {
          return err({
            type:
              reserved.error.type === "insufficient_stock"
                ? "insufficient_stock"
                : "invalid_order",
            message: reserved.error.message,
          });
        }

        reservations.push(reserved.value);
      }

      for (const reservation of reservations) {
        await inventory.save(reservation);
      }

      await orders.save(order.value);
      await carts.save(clearCart(cart, now));
      await stageEvent({ outbox, ids, clock }, orderCreated(order.value, now));

      return ok(order.value);
    });
}
